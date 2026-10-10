import { loadBoard } from "@safe-paws/db";
import type { Board, User } from "@safe-paws/shared/protocol";

export type PublicSnapshot = { users: User[]; board: Board };

/**
 * What visitors who aren't signed in may see: every animal, its photos and
 * updates, and how many people follow and like it. Not who: followers and
 * likes become counts, offers to help are left out entirely, and the only
 * people listed are those named on an update or change (staff), by name.
 */
export async function publicBoard(): Promise<PublicSnapshot> {
  const { users, board } = await loadBoard();
  const named = new Set<string>();
  const animals = Object.fromEntries(
    Object.entries(board.animals).map(([id, a]) => {
      a.notes.forEach((n) => named.add(n.authorId));
      a.media.forEach((m) => named.add(m.addedBy));
      named.add(a.updatedBy);
      return [
        id,
        {
          ...a,
          followers: a.followers.map((_, i) => `follower-${i}`),
          likes: a.likes.map((_, i) => `like-${i}`),
          requests: [],
        },
      ];
    }),
  );
  return {
    users: users.filter((u) => named.has(u.id)).map((u) => ({ id: u.id, name: u.name, role: u.role, title: "" })),
    board: { ...board, animals },
  };
}
