# ALS (collaborative filtering)
# "People who read what you read also loved that." No genres, no content —
# the embeddings are learned purely from the interaction matrix.
#
# Implementation: Hu, Koren & Volinsky (2008) implicit-feedback ALS, plain
# NumPy. (No `implicit`/`scipy-sparse` dependency — the data scale here
# is small enough for dense matrices; see the scale note below.)
#
# The math, the one trick worth knowing:
#   preference  p_ui = 1 where the user interacted, 0 otherwise
#   confidence  c_ui = 1 + alpha * interest_ui   (α=40 in the paper)
#   Each alternating step solves, per row:
#       x_u = (Yᵀ C_u Y + λI)⁻¹ Yᵀ C_u p_u
#   With C_u = I + diag(α r_u):
#       A_u = YᵀY + λI + α Σ_{i: r_ui>0} r_ui y_i y_iᵀ   ← only touched items
#       b_u = Σ_{i: r_ui>0} (1 + α r_ui) y_i              ← only touched items
#   YᵀY is the same for every user — precompute once, and the per-user step
#   costs O(nnz_u · f²) instead of O(n_items · f²).
#
# Choice note: the paper sets p=1 for UNSEEN entries too (w-ALS), which works
# when n_items >> f. At this platform's scale that would drag every score
# toward 1 equally, so we use the common variant: unobserved pairs are pulled
# toward 0. People who share clusters still rank cluster items far above
# everything else — see test_train_converges.
#
# Scale note: build_interaction_matrix materializes a dense (users × items)
# float64 matrix. Fine for ≤ ~10⁷ cells; past that, swap in a sparse build.
#
# Cold users (no interactions) solve to the zero vector — neutral scores, all
# ties. The batch pipeline gives them the popularity/hybrid fallback instead.

from dataclasses import dataclass

import numpy as np
import pandas as pd

from recommender.features.interest import build_interactions, interest_score
from recommender.models.popularity import get_user_owned_blogs, get_user_read_blogs


DEFAULT_FACTORS = 16
DEFAULT_REG = 0.1
DEFAULT_ALPHA = 40.0
DEFAULT_ITERATIONS = 10
DEFAULT_TOP_N = 10


# ─── Middle: matrix building + training (no DB access) ───

def score_interactions(
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    now: pd.Timestamp,
    half_life_days: float = 30,
) -> pd.DataFrame:
    """One row per (user, blog) with an interest score in roughly [-0.1, 1]."""
    interactions = build_interactions(sessions, bookmarks, comments)
    if interactions.empty:
        return interactions
    interactions["interest"] = interest_score(interactions, now, half_life_days)
    return interactions


def build_interaction_matrix(interactions: pd.DataFrame):
    """
    Turn scored interactions into the implicit-feedback matrix.

    Returns (matrix, users, items): users/items are the index lists, so
    matrix[i, j] is the interest of users[i] on items[j]. Negative interest
    (a bounce) is clipped to 0 — implicit ALS has no dislikes, only weak
    vs strong positive signals; the aversion logic lives in content/hybrid.
    """
    users = interactions["user_id"].dropna().unique().tolist()
    items = interactions["blog_id"].dropna().unique().tolist()
    user_pos = {u: i for i, u in enumerate(users)}
    item_pos = {b: i for i, b in enumerate(items)}

    matrix = np.zeros((len(users), len(items)), dtype=np.float64)
    if not interactions.empty:
        for row in interactions.itertuples(index=False):
            matrix[user_pos[row.user_id], item_pos[row.blog_id]] = max(0.0, float(row.interest))
    return matrix, users, items


def _als_solve(A: np.ndarray, b: np.ndarray, reg: float, f: int) -> np.ndarray:
    """Solve (A + λI) x = b, falling back to lstsq if nearly singular."""
    A = A + np.eye(f) * reg
    try:
        return np.linalg.solve(A, b)
    except np.linalg.LinAlgError:
        return np.linalg.lstsq(A, b, rcond=None)[0]


def train_als(
    matrix: np.ndarray,
    users: list[str],
    items: list[str],
    *,
    factors: int = DEFAULT_FACTORS,
    regularization: float = DEFAULT_REG,
    alpha: float = DEFAULT_ALPHA,
    iterations: int = DEFAULT_ITERATIONS,
    seed: int = 42,
):
    """
    Fit user/item factor matrices. Returns an ALSModel.
    Deterministic for a fixed seed.
    """
    n_users, n_items = matrix.shape
    rng = np.random.default_rng(seed)
    scale = 0.01 / np.sqrt(factors)
    X = rng.normal(0.0, scale, size=(n_users, factors))
    Y = rng.normal(0.0, scale, size=(n_items, factors))

    # Per-row positive-entry structures computed once (positions + values)
    def positives(m: np.ndarray):
        return [
            (np.flatnonzero(row > 0), row[row > 0])
            for row in m
        ]

    user_positives = positives(matrix)
    item_positives = positives(matrix.T)

    yty = Y.T @ Y                    # Σ y yᵀ — same for all users
    xtx = X.T @ X

    for _ in range(iterations):
        for u, (idx, vals) in enumerate(user_positives):
            contributions = Y[idx] * vals[:, None]             # (nnz_u, f)
            bonus = contributions.T @ Y[idx]                   # Σ r y yᵀ
            b = (1.0 + alpha * vals[:, None] * contributions).sum(axis=0)
            A = yty + alpha * bonus
            X[u] = _als_solve(A, b, regularization, factors)

        for i, (idx, vals) in enumerate(item_positives):
            contributions = X[idx] * vals[:, None]
            bonus = contributions.T @ X[idx]
            b = (1.0 + alpha * vals[:, None] * contributions).sum(axis=0)
            A = xtx + alpha * bonus
            Y[i] = _als_solve(A, b, regularization, factors)

        yty = Y.T @ Y
        xtx = X.T @ X

    return {
        "factors": factors,
        "regularization": regularization,
        "alpha": alpha,
        "iterations": iterations,
        "users": users,
        "items": items,
        "user_factors": X,
        "item_factors": Y,
    }


@dataclass
class ALSModel:
    """Trained embeddings + the index tables to translate ids."""
    users: list[str]
    items: list[str]
    user_factors: np.ndarray
    item_factors: np.ndarray
    factors: int = DEFAULT_FACTORS
    regularization: float = DEFAULT_REG
    alpha: float = DEFAULT_ALPHA
    iterations: int = DEFAULT_ITERATIONS

    _user_pos: dict = None
    _item_pos: dict = None

    def __post_init__(self):
        self._user_pos = {u: i for i, u in enumerate(self.users)}
        self._item_pos = {b: i for i, b in enumerate(self.items)}

    def user_vector(self, user_id: str) -> np.ndarray | None:
        pos = self._user_pos.get(user_id)
        return None if pos is None else self.user_factors[pos]

    def score_pairs(self, user_id: str, blog_ids: list[str]) -> dict[str, float]:
        """Dot product of the user's vector against the given items."""
        x = self.user_vector(user_id)
        if x is None:
            return {b: 0.0 for b in blog_ids}
        scores = {}
        for b in blog_ids:
            j = self._item_pos.get(b)
            scores[b] = float(x @ self.item_factors[j]) if j is not None else 0.0
        return scores


def fit(
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    *,
    now: pd.Timestamp,
    factors: int = DEFAULT_FACTORS,
    regularization: float = DEFAULT_REG,
    alpha: float = DEFAULT_ALPHA,
    iterations: int = DEFAULT_ITERATIONS,
) -> ALSModel:
    """One call to go from the four tables to a trained ALSModel."""
    interactions = score_interactions(sessions, bookmarks, comments, now=now)
    matrix, users, items = build_interaction_matrix(interactions)
    trained = train_als(
        matrix, users, items,
        factors=factors, regularization=regularization,
        alpha=alpha, iterations=iterations,
    )
    return ALSModel(
        users=trained["users"], items=trained["items"],
        user_factors=trained["user_factors"], item_factors=trained["item_factors"],
        factors=factors, regularization=regularization, alpha=alpha,
        iterations=iterations,
    )


def rank_user(
    model: ALSModel,
    user_id: str,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    top_n: int = DEFAULT_TOP_N,
) -> pd.DataFrame:
    """
    Score every blog for one user with the embeddings.
    Returns [blog_id, als_score] best first, read + own blogs removed.
    """
    exclude = get_user_read_blogs(user_id, sessions, bookmarks, comments) | \
        get_user_owned_blogs(user_id, blogs)
    eligible = blogs[~blogs["blog_id"].isin(exclude)]
    if eligible.empty:
        return pd.DataFrame(columns=["blog_id", "als_score"])

    scores = model.score_pairs(user_id, eligible["blog_id"].tolist())
    ranked = pd.DataFrame({
        "blog_id": list(scores.keys()),
        "als_score": list(scores.values()),
    })
    return ranked.sort_values("als_score", ascending=False).head(top_n).reset_index(drop=True)


def recommend_als(
    user_id: str,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    *,
    top_n: int = DEFAULT_TOP_N,
    now: pd.Timestamp | None = None,
    **fit_kwargs,
) -> list[str]:
    """Convenience one-shot: fit from scratch + recommend. Slow — fitting the
    embeddings per call is wasteful; use fit() once for batch/eval."""
    if now is None:
        now = pd.Timestamp.now(tz="UTC")
    model = fit(blogs, sessions, bookmarks, comments, now=now, **fit_kwargs)
    ranked = rank_user(model, user_id, blogs, sessions, bookmarks, comments, top_n)
    return ranked["blog_id"].tolist()


# ─── Edge: persistence + loading ───

def save(model: ALSModel, path: str) -> str:
    """Write embeddings + id tables to a single .npz file."""
    np.savez_compressed(
        path,
        users=np.array(model.users),
        items=np.array(model.items),
        user_factors=model.user_factors,
        item_factors=model.item_factors,
        factors=np.array(model.factors),
        regularization=np.array(model.regularization),
        alpha=np.array(model.alpha),
        iterations=np.array(model.iterations),
    )
    return path


def load(path: str) -> ALSModel:
    block = np.load(path, allow_pickle=False)
    return ALSModel(
        users=list(block["users"]),
        items=list(block["items"]),
        user_factors=block["user_factors"],
        item_factors=block["item_factors"],
        factors=int(block["factors"]),
        regularization=float(block["regularization"]),
        alpha=float(block["alpha"]),
        iterations=int(block["iterations"]),
    )
