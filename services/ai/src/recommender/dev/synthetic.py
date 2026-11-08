# Synthetic dataset generator
# Generates fake-but-realistic users, blogs, reading sessions, bookmarks and
# comments IN MEMORY — same columns the real load_* functions return, no
# database touched.
#
# Why: the real database is a test fixture (a handful of users, one session
# each). With nothing to learn from and nothing to hold out, no model can be
# judged. This module fabricates a dataset where WE know the answer: each user
# is assigned hidden genre tastes, and their behavior follows them —
#   good genre match  -> long reads, high scroll, completions, bookmarks, comments
#   bad genre match   -> quick bounce (short session, low scroll)
# The models only ever see the interaction tables, never the hidden tastes. If
# a trained recommender recovers those tastes and beats the popularity
# baseline, the pipeline works. If it can't on data where the signal is
# guaranteeably there, the bug is in our code, not in data shortage.
#
# Reproducibility: a fixed seed + a fixed "now" produce byte-identical data
# every run, which makes debugging a failing evaluation possible.

import uuid

import numpy as np
import pandas as pd

SEED = 42

# The instant the synthetic world is anchored to. Real data is "now"-relative;
# here everything is fixed so the half-life decay inside the models has
# something stable to work with and repeated runs are identical.
# Evaluation code should pass this as `now=`.
SYNTHETIC_NOW = pd.Timestamp("2026-07-01", tz="UTC")

N_USERS = 60
N_BLOGS = 180
HISTORY_DAYS = 90.0  # reading activity spreads over the past N days

# ─── Vocabulary (matches the product) ───

# Same strings as packages/shared SETTINGS_GENRES, so a synthetic row could
# plausibly appear in the real database.
GENRES = [
    "Essays", "Design", "Technology", "Philosophy", "Culture",
    "Science", "Fiction", "Poetry", "History", "Travel",
]

# Flavor text pools. Purely cosmetic — they only need to look like real rows.
FIRST_NAMES = [
    "Ada", "Arjun", "Bela", "Carlos", "Dara", "Elsa", "Farid", "Gita",
    "Hana", "Ivan", "June", "Kabir", "Lena", "Mira", "Nadia", "Omar",
    "Priya", "Quinn", "Rosa", "Sana", "Tara", "Umar", "Vera", "Wren",
    "Xavi", "Yuki", "Zara", "Niko", "Onur", "Selin",
]
LAST_NAMES = [
    "Chowdhury", "Das", "Erdos", "Farooq", "Ghosh", "Haddad", "Iyer",
    "Jensen", "Kaur", "Lindgren", "Moreau", "Nair", "Okafor", "Patel",
    "Quiroz", "Rahman", "Silva", "Tan", "Ustinov", "Vasquez",
    "Weber", "Xu", "Yilmaz", "Zhou", "Banerjee", "Costa",
    "Devi", "Ferreira", "Gomez", "Hossain",
]
ADJECTIVES = [
    "Slow", "Quiet", "Broken", "Honest", "Small", "Late", "Golden",
    "Electric", "Forgotten", "Everyday", "Borrowed", "Restless", "Open",
]
GENRE_NOUNS = {
    "Essays": ["Arguments", "Notices", "Fragments", "Observations", "Margins"],
    "Design": ["Interfaces", "Grids", "Sketches", "Tools", "Prototypes"],
    "Technology": ["Machines", "Compilers", "Terminals", "Protocols", "Servers"],
    "Philosophy": ["Doubts", "Questions", "Absence", "Meaning", "Silence"],
    "Culture": ["Traditions", "Cities", "Rituals", "Neighbors", "Markets"],
    "Science": "Cells Orbit Atoms Clocks Gardens".split(),
    "Fiction": ["Doors", "Trains", "Islands", "Letters", "Winters"],
    "Poetry": ["Elegies", "Seasons", "Rivers", "Lamps", "Breaths"],
    "History": ["Archives", "Empires", "Maps", "Ledgers", "Ruins"],
    "Travel": ["Roads", "Harbors", "Stations", "Layovers", "Hostels"],
}
DESCRIPTION_TEMPLATES = [
    "Notes on {noun_lower}, drawn from months of paying attention.",
    "What {noun_lower} can teach us about looking twice.",
    "A short piece about {noun_lower} and what it costs us.",
    "Filed under {genre_lower}, but really about {noun_lower}.",
    "Everything I got wrong about {noun_lower}, and one thing I got right.",
]
COMMENT_BODIES = [
    "Loved this — saved it for a second read.",
    "This articulated something I'd been circling for weeks.",
    "Great piece. The middle section especially.",
    "Came for the topic, stayed for the writing.",
    "Read this twice already. Thank you for writing it.",
    "Interesting framing. I'd push back a little, but worth it.",
    "This is the kind of writing that makes the feed worth opening.",
    "Sharing this with my book club.",
]
REPLY_BODIES = [
    "This.", "+1 to everything here.", "Exactly what I was thinking.",
    "Curious how you'd see it after a reread.",
]
BIOS = [
    "Reading more than I write, usually.",
    "{genre} mostly. Occasional detours.",
    "Notes from a desk near a window.",
    "Here for {genre} and long walks.",
    None,  # some users never filled a bio
]


def _uuid(rng: np.random.Generator) -> str:
    """Deterministic UUID as a string — same as what Postgres' gen_random_uuid() would store."""
    return str(uuid.UUID(bytes=rng.bytes(16), version=4))


# ─── Hidden tastes + behavior, the ground truth the models never see ───

def _sample_tastes(rng: np.random.Generator, genres: list[str]) -> dict:
    """Each user secretly likes 2–3 genres and dislikes 1–2; the rest are neutral."""
    shuffled = list(rng.permutation(genres))
    n_like = int(rng.integers(2, 4))       # 2 or 3 liked genres
    n_dislike = int(rng.integers(1, 3))    # 1 or 2 disliked genres
    return {
        "likes": shuffled[:n_like],
        "dislikes": shuffled[n_like:n_like + n_dislike],
        "neutral": shuffled[n_like + n_dislike:],
    }


def _tier(blog_genre_set: set[str], likes: set[str], dislikes: set[str]) -> str:
    """How a user's hidden tastes line up with one blog."""
    like_hits = len(blog_genre_set & likes)
    dis_hits = len(blog_genre_set & dislikes)
    if like_hits and dis_hits:
        return "mixed"      # liked AND disliked genre on one blog -> ambivalent
    if like_hits:
        return "match"
    if dis_hits:
        return "conflict"
    return "neutral"


# Behavior per tier. Numbers chosen so the interest signal in
# features/interest.py can actually separate the tiers:
#   bounce = active_seconds < 15 AND max_scroll < 20  (punished by the scorer)
#   completed + bookmark + comment = the big positive terms
_TIER_PROFILE = {
    "match": dict(seconds=(60, 600), scroll=(55, 100), completed=0.60,
                  bookmark=0.40, comment=0.25, revisit=0.15),
    "mixed": dict(seconds=(25, 300), scroll=(20, 90), completed=0.12,
                  bookmark=0.05, comment=0.05, revisit=0.05),
    "neutral": dict(seconds=(15, 240), scroll=(15, 85), completed=0.08,
                    bookmark=0.05, comment=0.04, revisit=0.04),
    "conflict": dict(seconds=(3, 35), scroll=(2, 22), completed=0.00,
                     bookmark=0.01, comment=0.0, revisit=0.0),
}

# How likely a user is to pick a blog of each tier. Conflict is never zero —
# real feeds show people things they don't like, and those bounces are signal.
_TIER_PICK_WEIGHT = {"match": 1.0, "neutral": 0.35, "mixed": 0.25, "conflict": 0.08}


def _simulate_session(rng, tier: str, started_at: pd.Timestamp) -> dict:
    """Turn one visit into a reading_sessions row (plus completion adjustments)."""
    p = _TIER_PROFILE[tier]
    seconds = int(rng.integers(*p["seconds"]))
    scroll = int(rng.integers(*p["scroll"]))

    completed = bool(rng.random() < p["completed"])
    if completed:
        # Finishing a post must look like finishing: full depth, real time.
        scroll = max(scroll, 95)
        seconds = max(seconds, 180)

    return {
        "active_seconds": min(seconds, 86400),
        "max_scroll_percent": min(max(scroll, 0), 100),
        "completed": completed,
        "started_at": started_at,
        "updated_at": started_at + pd.Timedelta(seconds=seconds),
    }


# ─── Generators, one per table, mimicking each load_* return ───

def _generate_users(rng, uids: list[str], now: pd.Timestamp, truths: dict) -> list[dict]:
    rows = []
    for i, uid in enumerate(uids):
        first = str(rng.choice(FIRST_NAMES))
        last = str(rng.choice(LAST_NAMES))
        handle = f"{first.lower()}{last[0].lower()}{i}"
        bio = str(rng.choice(BIOS))
        # users.fav_genre is a noisy *self-report* (onboarding chips): one true
        # like plus one random genre. The clean hidden list lives only in
        # ground_truth — the models must not get the answers for free.
        others = [g for g in GENRES if g not in truths[uid]["likes"]]
        rows.append({
            "id": uid,
            "name": f"{first} {last}",
            "email": f"{handle}@example.com",
            "handle": handle,
            "fav_genre": [truths[uid]["likes"][0], str(rng.choice(others))],
            "avatar": None if rng.random() < 0.2 else _uuid(rng)[:8],
            "bio": None if bio == "None" else bio,
            "onboarding_completed": bool(rng.random() < 0.9),
            "created_at": now - pd.Timedelta(days=float(rng.uniform(300, 500))),
            "updated_at": now - pd.Timedelta(days=float(rng.uniform(0, 30))),
        })
    return rows


def _generate_blogs(rng, users: list[dict], n_blogs: int, now: pd.Timestamp) -> list[dict]:
    rows = []
    uids = [u["id"] for u in users]
    for _ in range(n_blogs):
        author = str(rng.choice(uids))
        primary = str(rng.choice(GENRES))
        genres = [primary]
        if rng.random() < 0.35:  # some posts carry a second tag
            genres.append(str(rng.choice([g for g in GENRES if g != primary])))
        noun = str(rng.choice(GENRE_NOUNS[primary]))
        title = f"{rng.choice(ADJECTIVES)} {noun}" if rng.random() < 0.7 else noun
        created = now - pd.Timedelta(days=float(rng.uniform(8, 160)))
        rows.append({
            "blog_id": _uuid(rng),
            "user_id": author,
            "title": title,
            "blog_description": str(rng.choice(DESCRIPTION_TEMPLATES)).format(
                noun_lower=noun.lower(), genre_lower=primary.lower()
            ),
            "images": [] if rng.random() < 0.6 else [f"https://img.example.com/{_uuid(rng)[:8]}.jpg"],
            "genres": genres,
            "status": "published",  # loader filters to published; generate only published
            "published_at": created,
            "created_at": created - pd.Timedelta(days=float(rng.uniform(1, 5))),
            "updated_at": created,
        })
    return rows


def generate(
    seed: int = SEED,
    n_users: int = N_USERS,
    n_blogs: int = N_BLOGS,
    now: pd.Timestamp = SYNTHETIC_NOW,
    history_days: float = HISTORY_DAYS,
) -> dict:
    """
    Build the full synthetic dataset. Returns a dict of DataFrames:
      users, blogs (published only), sessions, bookmarks, comments,
      ground_truth (hidden tastes, for evaluation only), now.
    Empty parent_comment_id means a top-level comment, as in the real table.
    """
    rng = np.random.default_rng(seed)

    uids = [_uuid(rng) for _ in range(n_users)]
    truths = {uid: _sample_tastes(rng, GENRES) for uid in uids}
    users = _generate_users(rng, uids, now, truths)
    blogs = _generate_blogs(rng, users, n_blogs, now)
    blog_meta = [
        {"id": b["blog_id"], "author": b["user_id"], "genre_set": set(b["genres"])}
        for b in blogs
    ]

    sessions_rows, bookmark_rows, comment_rows = [], [], []
    comment_ids_by_blog: dict[str, list[str]] = {}

    for user in users:
        uid = user["id"]
        likes = set(truths[uid]["likes"])
        dislikes = set(truths[uid]["dislikes"])

        # Pick which blogs this user reads: weighted toward taste matches,
        # excluding their own posts (the rec filters exclude them anyway, and
        # evaluating on your own post makes no sense).
        candidates = [b for b in blog_meta if b["author"] != uid]
        weights = np.array([
            _TIER_PICK_WEIGHT[_tier(b["genre_set"], likes, dislikes)] for b in candidates
        ])
        n_reads = int(min(rng.integers(12, 40), len(candidates)))
        picks = rng.choice(len(candidates), size=n_reads, replace=False, p=weights / weights.sum())

        for pick in picks:
            blog = candidates[int(pick)]
            tier = _tier(blog["genre_set"], likes, dislikes)
            started = now - pd.Timedelta(seconds=float(rng.uniform(0.5, history_days) * 86400))
            visit = _simulate_session(rng, tier, started)

            sessions_rows.append({
                "user_id": uid, "blog_id": blog["id"], "session_id": _uuid(rng), **visit,
            })

            # Occasional re-read: a second, shorter session on the same post.
            if tier == "match" and rng.random() < _TIER_PROFILE["match"]["revisit"]:
                revisit = _simulate_session(rng, "neutral", started + pd.Timedelta(days=float(rng.uniform(1, 10))))
                revisit["completed"] = False
                revisit["max_scroll_percent"] = 100
                sessions_rows.append({
                    "user_id": uid, "blog_id": blog["id"], "session_id": _uuid(rng), **revisit,
                })

            if rng.random() < _TIER_PROFILE[tier]["bookmark"]:
                bookmark_rows.append({
                    "id": _uuid(rng),
                    "user_id": uid,
                    "blog_id": blog["id"],
                    # Bookmarked shortly after the reading session ended.
                    "created_at": visit["updated_at"] + pd.Timedelta(minutes=float(rng.uniform(1, 1440))),
                })

            if rng.random() < _TIER_PROFILE[tier]["comment"]:
                pool = comment_ids_by_blog.setdefault(blog["id"], [])
                is_reply = bool(pool) and rng.random() < 0.25  # replies need an existing parent
                body = str(rng.choice(REPLY_BODIES if is_reply else COMMENT_BODIES))
                cid = _uuid(rng)
                comment_rows.append({
                    "id": cid,
                    "blog_id": blog["id"],
                    "user_id": uid,
                    # Replies attach to their parent (two visible levels, like the app).
                    "parent_comment_id": str(rng.choice(pool)) if is_reply else None,
                    "body": body,
                    "created_at": visit["updated_at"] + pd.Timedelta(minutes=float(rng.uniform(1, 720))),
                    "updated_at": visit["updated_at"] + pd.Timedelta(minutes=float(rng.uniform(1, 720))),
                })
                pool.append(cid)

    ground_truth = pd.DataFrame([
        {"user_id": u["id"], **{k: v for k, v in truths[u["id"]].items()}}
        for u in users
    ])

    data = {
        "users": pd.DataFrame(users),
        "blogs": pd.DataFrame(blogs),
        "sessions": pd.DataFrame(sessions_rows),
        "bookmarks": pd.DataFrame(bookmark_rows),
        "comments": pd.DataFrame(comment_rows),
        "ground_truth": ground_truth,  # evaluation ONLY — never feed to a model
        "now": now,
    }
    _sanity_check(data)
    return data


def synthetic_dataset(**kwargs) -> dict:
    """Same shape as models.popularity.load_all(): only what the models consume."""
    data = generate(**kwargs)
    return {k: data[k] for k in ["users", "blogs", "sessions", "bookmarks", "comments"]}


def _sanity_check(data: dict) -> None:
    """Fail loudly if the generated world is inconsistent with the schema."""
    blog_ids = set(data["blogs"]["blog_id"])
    authors = dict(zip(data["blogs"]["blog_id"], data["blogs"]["user_id"]))
    s = data["sessions"]
    assert set(s["blog_id"]) <= blog_ids, "session references unknown blog"
    assert set(data["bookmarks"]["blog_id"]) <= blog_ids, "bookmark references unknown blog"
    assert set(data["comments"]["blog_id"]) <= blog_ids, "comment references unknown blog"
    # Nobody reads/bookmarks/comments on their own post (matches rec filters).
    for df in (s, data["bookmarks"], data["comments"]):
        assert (df["blog_id"].map(authors) != df["user_id"]).all(), "self-interaction found"
    # Schema guarantees: one bookmark per (user, blog); session PK uniqueness.
    assert not data["bookmarks"].duplicated(["user_id", "blog_id"]).any()
    assert not s.duplicated(["user_id", "blog_id", "session_id"]).any()
    # Every bookmark/comment sits on a (user, blog) the user actually read.
    read_pairs = set(zip(s["user_id"], s["blog_id"]))
    assert all(p in read_pairs for p in zip(data["bookmarks"]["user_id"], data["bookmarks"]["blog_id"]))
    assert all(p in read_pairs for p in zip(data["comments"]["user_id"], data["comments"]["blog_id"]))


if __name__ == "__main__":
    from recommender.features.interest import build_interactions, interest_score

    data = generate()
    print(f"users={len(data['users'])} blogs={len(data['blogs'])} "
          f"sessions={len(data['sessions'])} bookmarks={len(data['bookmarks'])} "
          f"comments={len(data['comments'])}")

    # The one check that matters: does the interest scorer SEE the hidden signal?
    inter = build_interactions(data["sessions"], data["bookmarks"], data["comments"])
    inter["interest"] = interest_score(inter, data["now"])
    inter = inter.merge(data["blogs"][["blog_id", "genres"]], on="blog_id")
    inter = inter.merge(data["ground_truth"], on="user_id")

    hit = inter.apply(
        lambda r: len(set(r["genres"]) & set(r["likes"])) > 0, axis=1
    )
    bounce = inter.apply(
        lambda r: len(set(r["genres"]) & set(r["dislikes"])) > 0
        and len(set(r["genres"]) & set(r["likes"])) == 0, axis=1
    )
    print(f"mean interest on taste-matched blogs : {inter.loc[hit, 'interest'].mean():.3f}")
    print(f"mean interest on taste-conflict blogs: {inter.loc[bounce, 'interest'].mean():.3f}")
    print("(first should be clearly higher — that gap is the signal models must recover)")
