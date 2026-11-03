// Chat Hall sidebar — every member visible, present or not. Online members
// sort above; roles keep their badges from the members tab (admin👑 mod🛡).
import { Crown, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import type { ClubMemberDTO } from "@quill/shared";
import { assetUrl } from "../../auth/api/auth.api";
import { getInitials } from "../../../lib/initials";

const ROLE_RANK: Record<ClubMemberDTO["role"], number> = {
  admin: 0,
  moderator: 1,
  member: 2,
};

const ROLE_TAG: Record<ClubMemberDTO["role"], string> = {
  admin: "text-[#B27D56]",
  moderator: "text-[#5C6B4F]",
  member: "text-[#8A8F8B]",
};

const MemberAvatar = ({ member }: { member: ClubMemberDTO }) => {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(member.avatar);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${member.name}'s profile`}
        onError={() => setFailed(true)}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#5C6B4F] font-editorial text-[12px] text-white">
      {getInitials(member.name) || "?"}
    </div>
  );
};

const PresenceDot = ({ online }: { online?: boolean }) => (
  <span
    aria-hidden
    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#FBFAF6] ${
      online ? "bg-[#3E7A5E]" : "bg-[#C9CDBF]"
    }`}
    title={online ? "Online" : "Offline"}
  />
);

const ChatMembersSidebar = ({ members }: { members: ClubMemberDTO[] }) => {
  const onlineCount = members.filter((m) => m.online).length;
  const sorted = [...members].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    if (ROLE_RANK[a.role] !== ROLE_RANK[b.role])
      return ROLE_RANK[a.role] - ROLE_RANK[b.role];
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[#E6E2D6] px-4 py-3">
        <Users className="w-4 h-4 text-[#8A8F8B]" />
        <h2 className="font-editorial text-[16px] text-[#1B1F1C]">Members</h2>
        <span className="ml-auto text-[12px] text-[#8A8F8B]">
          {onlineCount}/{members.length} online
        </span>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 py-2">
        {sorted.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-[#F0EDE4]"
          >
            <div className="relative shrink-0">
              <MemberAvatar member={member} />
              <PresenceDot online={member.online} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-[13px] ${
                  member.online ? "text-[#1B1F1C]" : "text-[#8A8F8B]"
                }`}
              >
                {member.name}
              </p>
              {member.handle && (
                <p className="truncate text-[11px] text-[#8A8F8B]">
                  @{member.handle}
                </p>
              )}
            </div>
            {member.role !== "member" && (
              <span
                className={`flex shrink-0 items-center gap-0.5 text-[11px] font-medium ${ROLE_TAG[member.role]}`}
                title={member.role === "admin" ? "Admin" : "Moderator"}
              >
                {member.role === "admin" ? (
                  <Crown className="w-3 h-3" />
                ) : (
                  <ShieldCheck className="w-3 h-3" />
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatMembersSidebar;
