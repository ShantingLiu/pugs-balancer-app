import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { Player, Role } from "@engine/types";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { getHeroesByRole } from "@utils/heroUtils";

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

const STADIUM_RANKS = [
  "Rookie 5", "Rookie 4", "Rookie 3", "Rookie 2", "Rookie 1",
  "Novice 5", "Novice 4", "Novice 3", "Novice 2", "Novice 1",
  "Contender 5", "Contender 4", "Contender 3", "Contender 2", "Contender 1",
  "Elite 5", "Elite 4", "Elite 3", "Elite 2", "Elite 1",
  "Pro 5", "Pro 4", "Pro 3", "Pro 2", "Pro 1",
  "All-Star 5", "All-Star 4", "All-Star 3", "All-Star 2", "All-Star 1",
  "Legend 5", "Legend 4", "Legend 3", "Legend 2", "Legend 1",
];

const COMP_RANKS = [
  "Bronze 5", "Bronze 4", "Bronze 3", "Bronze 2", "Bronze 1",
  "Silver 5", "Silver 4", "Silver 3", "Silver 2", "Silver 1",
  "Gold 5", "Gold 4", "Gold 3", "Gold 2", "Gold 1",
  "Platinum 5", "Platinum 4", "Platinum 3", "Platinum 2", "Platinum 1",
  "Emerald 5", "Emerald 4", "Emerald 3", "Emerald 2", "Emerald 1",
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
  tank6v6Rank: null,
  dps6v6Rank: null,
  support6v6Rank: null,
  rolesWilling: [],
  rolePreference: [],
  heroPool: [],
  isOneTrick: false,
  oneTrickHero: null,
  tankOneTrick: null,
  dpsOneTrick: null,
  supportOneTrick: null,
  regularCompRank: null,
  regular6v6Rank: null,
  weightModifier: 0,
  notes: null,
  stadiumWins: 0,
  regular5v5Wins: 0,
  regular6v6Wins: 0,
  allTimeWins: 0,
};

const RANK_ROLE_FIELDS: Array<{
  role: Role;
  textColorClass: string;
  stadiumField: "tankRank" | "dpsRank" | "supportRank";
  compField: "tankCompRank" | "dpsCompRank" | "supportCompRank";
}> = [
  { role: "Tank", textColorClass: "text-tank", stadiumField: "tankRank", compField: "tankCompRank" },
  { role: "DPS", textColorClass: "text-dps", stadiumField: "dpsRank", compField: "dpsCompRank" },
  { role: "Support", textColorClass: "text-sup", stadiumField: "supportRank", compField: "supportCompRank" },
];

export function AddPlayerModal({ isOpen, onClose, editPlayer }: AddPlayerModalProps) {
  const upsertPlayer = usePlayerStore((state) => state.upsertPlayer);
  const removePlayer = usePlayerStore((state) => state.removePlayer);
  const getPlayer = usePlayerStore((state) => state.getPlayer);
  const renamePlayerInSession = useSessionStore((state) => state.renamePlayerInSession);

  const [battletag, setBattletag] = useState("");
  const [originalBattletag, setOriginalBattletag] = useState("");
  const [form, setForm] = useState<Omit<Player, "battletag">>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!editPlayer;

  const HEROES_BY_ROLE: Record<Role, string[]> = {
    Tank: getHeroesByRole("Tank"),
    DPS: getHeroesByRole("DPS"),
    Support: getHeroesByRole("Support"),
  };

  useEffect(() => {
    if (isOpen) {
      if (editPlayer) {
        setBattletag(editPlayer.battletag);
        setOriginalBattletag(editPlayer.battletag);
        setForm({
          ...editPlayer,
          regular6v6Rank:
            editPlayer.regular6v6Rank ||
            editPlayer.tank6v6Rank ||
            editPlayer.dps6v6Rank ||
            editPlayer.support6v6Rank ||
            null,
        });
      } else {
        setBattletag("");
        setOriginalBattletag("");
        setForm({ ...EMPTY_FORM });
      }
      setErrors([]);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, editPlayer]);

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
      const cfg = RANK_ROLE_FIELDS.find((r) => r.role === role)!;
      if (
        !form[cfg.stadiumField] &&
        !form[cfg.compField] &&
        !form.regularCompRank &&
        !form.regular6v6Rank
      ) {
        errs.push(`${role} requires a Stadium, 5v5, or 6v6 rank`);
      }
    }

    const oneTrickHeroes = [form.tankOneTrick, form.dpsOneTrick, form.supportOneTrick].filter(Boolean);
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

    const oneTrickHeroes = [form.tankOneTrick, form.dpsOneTrick, form.supportOneTrick].filter(Boolean);
    const derivedIsOneTrick = oneTrickHeroes.length > 0;
    const derivedOneTrickHero = oneTrickHeroes[0] || null;

    const player: Player = {
      ...form,
      battletag,
      tank6v6Rank: null,
      dps6v6Rank: null,
      support6v6Rank: null,
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
      if (newRoles.length > 0 && newRoles.includes(role) && !newPref.includes(role)) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 app-backdrop flex items-center justify-center z-50">
      <div className="app-modal p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <h2 className="text-xl font-semibold text-ink mb-4">
          {isEditing ? "Edit Player" : "Add New Player"}
        </h2>

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-bad-soft border border-bad-edge rounded-well">
            <ul className="text-sm text-bad list-disc list-inside space-y-0.5">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {/* Battletag */}
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-1">Battletag *</label>
            <input
              type="text"
              value={battletag}
              onChange={(e) => setBattletag(e.target.value)}
              placeholder="Name or Name#1234"
              className="app-input w-full px-3 py-2 text-sm"
            />
          </div>

          {/* Roles Willing */}
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-1.5">Roles Willing *</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-4 py-2 rounded-pill text-sm font-semibold border ${
                    form.rolesWilling.includes(role)
                      ? role === "Tank"
                        ? "bg-yellow-600"
                        : role === "DPS"
                        ? "role-dps"
                        : "role-support"
                      : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft"
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
              <label className="block text-sm font-semibold text-ink-2 mb-1.5">
                Role Preference (first = most preferred)
              </label>
              <div className="flex flex-wrap gap-2.5">
                {(form.rolePreference.length === form.rolesWilling.length
                  ? form.rolePreference
                  : form.rolesWilling
                ).map((role, idx, arr) => (
                  <div key={role} className="flex items-center gap-1">
                    <span className="text-muted text-sm app-measured">{idx + 1}.</span>
                    <span
                      className={`px-3 py-1 rounded-pill text-sm font-semibold border ${
                        idx === 0
                          ? "bg-pink-soft border-pink-edge text-pink-ink"
                          : "bg-paper-3 border-rule text-ink-2"
                      }`}
                    >
                      {role}
                    </span>
                    <div className="flex flex-col">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newPref = [...arr];
                            [newPref[idx - 1], newPref[idx]] = [newPref[idx], newPref[idx - 1]];
                            setForm((prev) => ({ ...prev, rolePreference: newPref }));
                          }}
                          className="text-muted hover:text-ink px-1"
                          title="Move up"
                          aria-label={`Move ${role} up`}
                        >
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                      {idx < arr.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newPref = [...arr];
                            [newPref[idx], newPref[idx + 1]] = [newPref[idx + 1], newPref[idx]];
                            setForm((prev) => ({ ...prev, rolePreference: newPref }));
                          }}
                          className="text-muted hover:text-ink px-1"
                          title="Move down"
                          aria-label={`Move ${role} down`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ranks - Per Role + Shared 6v6 */}
          {form.rolesWilling.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-ink-2">
                Ranks per Role
                <span className="text-xs font-normal text-muted ml-2">
                  (Stadium or 5v5 Comp rank)
                </span>
              </div>

              {RANK_ROLE_FIELDS.filter(({ role }) => form.rolesWilling.includes(role)).map(
                ({ role, textColorClass, stadiumField, compField }) => (
                  <div key={role} className="p-3 app-well">
                    <div className={`text-sm font-semibold ${textColorClass} mb-2`}>{role}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Stadium Rank</label>
                        <select
                          value={form[stadiumField] || ""}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [stadiumField]: e.target.value || null }))
                          }
                          className="app-input w-full px-3 py-2 text-sm"
                        >
                          <option value="">None</option>
                          {STADIUM_RANKS.map((rank) => (
                            <option key={rank} value={rank}>{rank}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">5v5 Comp Rank</label>
                        <select
                          value={form[compField] || ""}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [compField]: e.target.value || null }))
                          }
                          className="app-input w-full px-3 py-2 text-sm"
                        >
                          <option value="">None</option>
                          {COMP_RANKS.map((rank) => (
                            <option key={rank} value={rank}>{rank}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )
              )}

              <div className="p-3 app-well">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="player-6v6-rank" className="text-sm font-semibold text-ink-2">
                    6v6 Comp Rank
                  </label>
                  <span className="text-xs text-muted">
                    Shared across all roles (no role lock)
                  </span>
                </div>
                <select
                  id="player-6v6-rank"
                  value={form.regular6v6Rank || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, regular6v6Rank: e.target.value || null }))
                  }
                  className="app-input w-full px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {COMP_RANKS.map((rank) => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Hero Pool */}
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-1.5">
              Hero Pool * ({form.heroPool.length} selected)
            </label>
            <div className="space-y-3">
              {ROLES.map((role) => (
                <div key={role}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-xs font-semibold text-ink-2">{role}</span>
                    <button
                      type="button"
                      onClick={() => selectAllHeroesForRole(role)}
                      className="text-xs font-semibold text-sky-ink hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => clearHeroesForRole(role)}
                      className="text-xs font-semibold text-bad hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {HEROES_BY_ROLE[role].map((hero) => (
                      <button
                        type="button"
                        key={hero}
                        onClick={() => toggleHero(hero)}
                        className={`px-2.5 py-1 rounded-pill text-xs font-semibold border ${
                          form.heroPool.includes(hero)
                            ? "bg-pink-soft border-pink-edge text-pink-ink"
                            : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft"
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
            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-ink-2">
                One-Trick Heroes
                <span className="text-xs font-normal text-muted ml-2">
                  (Select if player only plays one hero for a role)
                </span>
              </div>

              {form.rolesWilling.includes("Tank") && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-tank w-16">Tank</span>
                  <select
                    value={form.tankOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, tankOneTrick: e.target.value || null }))
                    }
                    className="app-input flex-1 px-3 py-1.5 text-sm"
                  >
                    <option value="">Not a one-trick</option>
                    {HEROES_BY_ROLE["Tank"].filter((h) => form.heroPool.includes(h)).map((hero) => (
                      <option key={hero} value={hero}>{hero}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.rolesWilling.includes("DPS") && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-dps w-16">DPS</span>
                  <select
                    value={form.dpsOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dpsOneTrick: e.target.value || null }))
                    }
                    className="app-input flex-1 px-3 py-1.5 text-sm"
                  >
                    <option value="">Not a one-trick</option>
                    {HEROES_BY_ROLE["DPS"].filter((h) => form.heroPool.includes(h)).map((hero) => (
                      <option key={hero} value={hero}>{hero}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.rolesWilling.includes("Support") && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-sup w-16">Support</span>
                  <select
                    value={form.supportOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, supportOneTrick: e.target.value || null }))
                    }
                    className="app-input flex-1 px-3 py-1.5 text-sm"
                  >
                    <option value="">Not a one-trick</option>
                    {HEROES_BY_ROLE["Support"].filter((h) => form.heroPool.includes(h)).map((hero) => (
                      <option key={hero} value={hero}>{hero}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Weight Modifier */}
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-1">
              Weight Modifier (<span className="app-measured">{form.weightModifier > 0 ? "+" : ""}{form.weightModifier}</span>)
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
              style={{ "--range-pct": `${((form.weightModifier + 500) / 1000) * 100}%` } as React.CSSProperties}
              className="w-full app-range"
            />
            <div className="flex justify-between text-xs text-muted app-measured">
              <span>-500 (weaker)</span>
              <span>0</span>
              <span>+500 (stronger)</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-1">Notes</label>
            <textarea
              value={form.notes || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value || null }))
              }
              placeholder="Optional notes about this player..."
              rows={2}
              className="app-input w-full px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-between gap-3 mt-6 pt-4 border-t border-rule">
          <div>
            {isEditing && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 app-danger rounded-pill text-sm font-semibold"
              >
                Delete Player
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-bad font-semibold">Are you sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 app-danger rounded-pill text-sm font-semibold"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 app-secondary rounded-pill text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 app-secondary rounded-pill text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 app-primary rounded-pill text-sm font-semibold"
            >
              {isEditing ? "Save Changes" : "Add Player"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
