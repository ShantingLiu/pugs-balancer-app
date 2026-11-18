import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { Player, Role } from "@engine/types";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { getHeroesForRoleAndMode } from "@utils/heroUtils";

// =============================================================================
// AddPlayerModal - Add or edit players in-app
// =============================================================================

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, edit this player instead of creating new */
  editPlayer?: Player | null;
}

const ROLES: Role[] = ["Tank", "DPS", "Support"];

// Stadium ranks for dropdowns (5 is lowest, 1 is highest within tier)
const STADIUM_RANKS = [
  "Rookie 5", "Rookie 4", "Rookie 3", "Rookie 2", "Rookie 1",
  "Novice 5", "Novice 4", "Novice 3", "Novice 2", "Novice 1",
  "Contender 5", "Contender 4", "Contender 3", "Contender 2", "Contender 1",
  "Elite 5", "Elite 4", "Elite 3", "Elite 2", "Elite 1",
  "Pro 5", "Pro 4", "Pro 3", "Pro 2", "Pro 1",
  "All-Star 5", "All-Star 4", "All-Star 3", "All-Star 2", "All-Star 1",
  "Legend 5", "Legend 4", "Legend 3", "Legend 2", "Legend 1",
];

// Regular competitive ranks for dropdowns
const COMP_RANKS = [
  "Bronze 5", "Bronze 4", "Bronze 3", "Bronze 2", "Bronze 1",
  "Silver 5", "Silver 4", "Silver 3", "Silver 2", "Silver 1",
  "Gold 5", "Gold 4", "Gold 3", "Gold 2", "Gold 1",
  "Platinum 5", "Platinum 4", "Platinum 3", "Platinum 2", "Platinum 1",
  "Diamond 5", "Diamond 4", "Diamond 3", "Diamond 2", "Diamond 1",
  "Master 5", "Master 4", "Master 3", "Master 2", "Master 1",
  "Grandmaster 5", "Grandmaster 4", "Grandmaster 3", "Grandmaster 2", "Grandmaster 1",
  "Champion 5", "Champion 4", "Champion 3", "Champion 2", "Champion 1",
];

const EMPTY_FORM: Omit<Player, "battletag"> = {
  tankRank: null,
  dpsRank: null,
  supportRank: null,
  tankCompRank: null,
  dpsCompRank: null,
  supportCompRank: null,
  rolesWilling: [],
  rolePreference: [],
  heroPool: [],
  isOneTrick: false,
  oneTrickHero: null,
  tankOneTrick: null,
  dpsOneTrick: null,
  supportOneTrick: null,
  regularCompRank: null,
  weightModifier: 0,
  notes: null,
  stadiumWins: 0,
  regular5v5Wins: 0,
  regular6v6Wins: 0,
  allTimeWins: 0,
};

function getRoleBadgeClass(role: Role): string {
  switch (role) {
    case "Tank":
      return "role-badge-tank";
    case "DPS":
      return "role-badge-dps";
    case "Support":
      return "role-badge-support";
  }
}

export function AddPlayerModal({ isOpen, onClose, editPlayer }: AddPlayerModalProps) {
  if (!isOpen) return null;
  return (
    <AddPlayerModalContent
      key={editPlayer?.battletag ?? "__new__"}
      onClose={onClose}
      editPlayer={editPlayer}
    />
  );
}

function AddPlayerModalContent({
  onClose,
  editPlayer,
}: Omit<AddPlayerModalProps, "isOpen">) {
  const upsertPlayer = usePlayerStore((state) => state.upsertPlayer);
  const removePlayer = usePlayerStore((state) => state.removePlayer);
  const getPlayer = usePlayerStore((state) => state.getPlayer);
  const renamePlayerInSession = useSessionStore((state) => state.renamePlayerInSession);
  const gameMode = useSessionStore((state) => state.gameMode);

  const [battletag, setBattletag] = useState(() => editPlayer?.battletag ?? "");
  const [originalBattletag] = useState(() => editPlayer?.battletag ?? "");
  const [form, setForm] = useState<Omit<Player, "battletag">>(() =>
    editPlayer ? { ...editPlayer } : { ...EMPTY_FORM }
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!editPlayer;

  const HEROES_BY_ROLE = useMemo<Record<Role, string[]>>(
    () => ({
      Tank: getHeroesForRoleAndMode("Tank", gameMode),
      DPS: getHeroesForRoleAndMode("DPS", gameMode),
      Support: getHeroesForRoleAndMode("Support", gameMode),
    }),
    [gameMode]
  );

  const validate = (): string[] => {
    const errs: string[] = [];

    if (!battletag.trim()) {
      errs.push("Battletag/name is required");
    }

    const isRenaming = isEditing && battletag !== originalBattletag;
    if (!isEditing && getPlayer(battletag)) {
      errs.push("A player with this battletag already exists");
    } else if (isRenaming && getPlayer(battletag)) {
      errs.push("A player with this battletag already exists");
    }

    if (form.rolesWilling.length === 0) {
      errs.push("Select at least one role willing to play");
    }

    for (const role of form.rolesWilling) {
      const stadiumRankField =
        role === "Tank" ? "tankRank" : role === "DPS" ? "dpsRank" : "supportRank";
      const compRankField =
        role === "Tank" ? "tankCompRank" : role === "DPS" ? "dpsCompRank" : "supportCompRank";
      if (!form[stadiumRankField] && !form[compRankField] && !form.regularCompRank) {
        errs.push(`${role} requires a Stadium rank or Regular Comp rank`);
      }
    }

    const oneTrickHeroes = [
      form.tankOneTrick,
      form.dpsOneTrick,
      form.supportOneTrick,
    ].filter(Boolean);
    for (const hero of oneTrickHeroes) {
      if (hero && !form.heroPool.includes(hero)) {
        errs.push(`One-trick hero "${hero}" must be in hero pool`);
      }
    }

    if (form.heroPool.length < 1) {
      errs.push("Add at least one hero to hero pool");
    }

    return errs;
  };

  const handleSubmit = () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const oneTrickHeroes = [
      form.tankOneTrick,
      form.dpsOneTrick,
      form.supportOneTrick,
    ].filter(Boolean);
    const derivedIsOneTrick = oneTrickHeroes.length > 0;
    const derivedOneTrickHero = oneTrickHeroes[0] || null;

    const player: Player = {
      ...form,
      battletag,
      isOneTrick: derivedIsOneTrick,
      oneTrickHero: derivedOneTrickHero,
      rolePreference: form.rolePreference.filter((r) => form.rolesWilling.includes(r)),
    };

    if (player.rolePreference.length !== player.rolesWilling.length) {
      player.rolePreference = [...player.rolesWilling];
    }

    const isRenaming = isEditing && battletag !== originalBattletag;

    if (isRenaming) {
      if (getPlayer(battletag)) {
        setErrors(["A player with this battletag already exists"]);
        return;
      }

      usePlayerStore.setState((state) => {
        const newPlayers = new Map(state.players);
        newPlayers.delete(originalBattletag);
        newPlayers.set(battletag, player);
        return { players: newPlayers };
      });

      renamePlayerInSession(originalBattletag, battletag);
      onClose();
      return;
    }

    upsertPlayer(player);
    onClose();
  };

  const handleDelete = () => {
    if (editPlayer) {
      removePlayer(editPlayer.battletag);
      onClose();
    }
  };

  const toggleRole = (role: Role) => {
    setForm((prev) => {
      const newRoles = prev.rolesWilling.includes(role)
        ? prev.rolesWilling.filter((r) => r !== role)
        : [...prev.rolesWilling, role];

      const newPref = prev.rolePreference.filter((r) => newRoles.includes(r));
      if (newRoles.length > 0 && !newRoles.includes(role) === false && !newPref.includes(role)) {
        newPref.push(role);
      }

      return {
        ...prev,
        rolesWilling: newRoles,
        rolePreference: newPref.filter((r) => newRoles.includes(r)),
      };
    });
  };

  const toggleHero = (hero: string) => {
    setForm((prev) => ({
      ...prev,
      heroPool: prev.heroPool.includes(hero)
        ? prev.heroPool.filter((h) => h !== hero)
        : [...prev.heroPool, hero],
    }));
  };

  const selectAllHeroesForRole = (role: "Tank" | "DPS" | "Support") => {
    setForm((prev) => {
      const roleHeroes = HEROES_BY_ROLE[role];
      const newPool = new Set(prev.heroPool);
      roleHeroes.forEach((h) => newPool.add(h));
      return { ...prev, heroPool: Array.from(newPool) };
    });
  };

  const clearHeroesForRole = (role: "Tank" | "DPS" | "Support") => {
    setForm((prev) => {
      const roleHeroes = new Set(HEROES_BY_ROLE[role]);
      return {
        ...prev,
        heroPool: prev.heroPool.filter((h) => !roleHeroes.has(h)),
      };
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 app-backdrop flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="app-modal p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-ink">
            {isEditing ? "Edit Player" : "Add New Player"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink p-1"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 p-3 app-alert-error">
            <ul className="text-sm text-bad list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {/* Battletag */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Battletag *</label>
            <input
              type="text"
              value={battletag}
              onChange={(e) => setBattletag(e.target.value)}
              placeholder="Name or Name#1234"
              className="w-full px-3 py-2 app-input"
            />
          </div>

          {/* Roles Willing */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Roles Willing *</label>
            <div className="flex gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-4 py-2 font-medium transition-colors ${
                    form.rolesWilling.includes(role) ? getRoleBadgeClass(role) : "app-chip"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Role Preference Order */}
          {form.rolesWilling.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Role Preference (first = most preferred)
              </label>
              <div className="flex gap-2">
                {(form.rolePreference.length === form.rolesWilling.length
                  ? form.rolePreference
                  : form.rolesWilling
                ).map((role, idx, arr) => (
                  <div key={role} className="flex items-center gap-1">
                    <span className="text-muted text-sm app-measured">{idx + 1}.</span>
                    <span
                      className={`px-3 py-1 text-sm ${
                        idx === 0 ? "app-chip-active" : "app-chip"
                      }`}
                    >
                      {role}
                    </span>
                    <div className="flex flex-col">
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            const newPref = [...arr];
                            [newPref[idx - 1], newPref[idx]] = [newPref[idx], newPref[idx - 1]];
                            setForm((prev) => ({ ...prev, rolePreference: newPref }));
                          }}
                          className="text-xs text-muted hover:text-ink px-1"
                          title="Move up"
                        >
                          ▲
                        </button>
                      )}
                      {idx < arr.length - 1 && (
                        <button
                          onClick={() => {
                            const newPref = [...arr];
                            [newPref[idx], newPref[idx + 1]] = [newPref[idx + 1], newPref[idx]];
                            setForm((prev) => ({ ...prev, rolePreference: newPref }));
                          }}
                          className="text-xs text-muted hover:text-ink px-1"
                          title="Move down"
                        >
                          ▼
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ranks - Per Role */}
          {form.rolesWilling.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-ink-2">
                Ranks per Role
                <span className="text-xs text-muted ml-2">
                  (Stadium rank preferred, or use Regular Comp rank as fallback)
                </span>
              </div>

              {form.rolesWilling.includes("Tank") && (
                <div className="p-3 app-subsurface">
                  <div className="text-sm font-medium role-text-tank mb-2">Tank</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Stadium Rank</label>
                      <select
                        value={form.tankRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, tankRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 text-sm app-input"
                      >
                        <option value="">None</option>
                        {STADIUM_RANKS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Regular Comp Rank</label>
                      <select
                        value={form.tankCompRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, tankCompRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 text-sm app-input"
                      >
                        <option value="">None</option>
                        {COMP_RANKS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {form.rolesWilling.includes("DPS") && (
                <div className="p-3 app-subsurface">
                  <div className="text-sm font-medium role-text-dps mb-2">DPS</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Stadium Rank</label>
                      <select
                        value={form.dpsRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, dpsRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 text-sm app-input"
                      >
                        <option value="">None</option>
                        {STADIUM_RANKS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Regular Comp Rank</label>
                      <select
                        value={form.dpsCompRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, dpsCompRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 text-sm app-input"
                      >
                        <option value="">None</option>
                        {COMP_RANKS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {form.rolesWilling.includes("Support") && (
                <div className="p-3 app-subsurface">
                  <div className="text-sm font-medium role-text-support mb-2">Support</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Stadium Rank</label>
                      <select
                        value={form.supportRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, supportRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 text-sm app-input"
                      >
                        <option value="">None</option>
                        {STADIUM_RANKS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">Regular Comp Rank</label>
                      <select
                        value={form.supportCompRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, supportCompRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 text-sm app-input"
                      >
                        <option value="">None</option>
                        {COMP_RANKS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hero Pool */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Hero Pool * ({form.heroPool.length} selected)
            </label>
            <div className="space-y-2">
              {ROLES.map((role) => (
                <div key={role}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted">{role}</span>
                    <button
                      type="button"
                      onClick={() => selectAllHeroesForRole(role)}
                      className="text-xs text-accent hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => clearHeroesForRole(role)}
                      className="text-xs text-bad hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {HEROES_BY_ROLE[role].map((hero) => (
                      <button
                        key={hero}
                        onClick={() => toggleHero(hero)}
                        className={`px-2.5 py-1 text-xs transition-colors ${
                          form.heroPool.includes(hero) ? "app-chip-active" : "app-chip"
                        }`}
                      >
                        {hero}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* One-trick per role */}
          {form.rolesWilling.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-ink-2">
                One-Trick Heroes
                <span className="text-xs text-muted ml-2">
                  (Select if player only plays one hero for a role)
                </span>
              </div>

              {form.rolesWilling.includes("Tank") && (
                <div className="flex items-center gap-3">
                  <span className="text-sm role-text-tank w-16">Tank:</span>
                  <select
                    value={form.tankOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, tankOneTrick: e.target.value || null }))
                    }
                    className="flex-1 px-3 py-1.5 text-sm app-input"
                  >
                    <option value="">Not a one-trick</option>
                    {HEROES_BY_ROLE["Tank"]
                      .filter((h) => form.heroPool.includes(h))
                      .map((hero) => (
                        <option key={hero} value={hero}>
                          {hero}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {form.rolesWilling.includes("DPS") && (
                <div className="flex items-center gap-3">
                  <span className="text-sm role-text-dps w-16">DPS:</span>
                  <select
                    value={form.dpsOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dpsOneTrick: e.target.value || null }))
                    }
                    className="flex-1 px-3 py-1.5 text-sm app-input"
                  >
                    <option value="">Not a one-trick</option>
                    {HEROES_BY_ROLE["DPS"]
                      .filter((h) => form.heroPool.includes(h))
                      .map((hero) => (
                        <option key={hero} value={hero}>
                          {hero}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {form.rolesWilling.includes("Support") && (
                <div className="flex items-center gap-3">
                  <span className="text-sm role-text-support w-16">Support:</span>
                  <select
                    value={form.supportOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, supportOneTrick: e.target.value || null }))
                    }
                    className="flex-1 px-3 py-1.5 text-sm app-input"
                  >
                    <option value="">Not a one-trick</option>
                    {HEROES_BY_ROLE["Support"]
                      .filter((h) => form.heroPool.includes(h))
                      .map((hero) => (
                        <option key={hero} value={hero}>
                          {hero}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Weight Modifier */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1 app-measured">
              Weight Modifier ({form.weightModifier > 0 ? "+" : ""}
              {form.weightModifier})
            </label>
            <input
              type="range"
              min="-500"
              max="500"
              step="50"
              value={form.weightModifier}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, weightModifier: parseInt(e.target.value) }))
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted app-measured">
              <span>-500 (weaker)</span>
              <span>0</span>
              <span>+500 (stronger)</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Notes</label>
            <textarea
              value={form.notes || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value || null }))
              }
              placeholder="Optional notes about this player…"
              rows={2}
              className="w-full px-3 py-2 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6 pt-4 border-t border-[var(--color-rule)]">
          <div>
            {isEditing && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 app-danger transition-colors"
              >
                Delete Player
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-bad">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 app-danger text-sm"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 app-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 app-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 app-primary transition-colors"
            >
              {isEditing ? "Save Changes" : "Add Player"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
