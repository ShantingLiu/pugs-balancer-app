import { useState, useEffect } from "react";
import type { Player, Role } from "@engine/types";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import heroesConfig from "@config/heroes.json";

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
const HEROES = Object.keys(heroesConfig.heroes);
const HEROES_BY_ROLE: Record<Role, string[]> = {
  Tank: HEROES.filter(
    (h) => (heroesConfig.heroes as Record<string, { role: string }>)[h].role === "Tank"
  ),
  DPS: HEROES.filter(
    (h) => (heroesConfig.heroes as Record<string, { role: string }>)[h].role === "DPS"
  ),
  Support: HEROES.filter(
    (h) => (heroesConfig.heroes as Record<string, { role: string }>)[h].role === "Support"
  ),
};

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
  allTimeWins: 0,
};

export function AddPlayerModal({ isOpen, onClose, editPlayer }: AddPlayerModalProps) {
  const upsertPlayer = usePlayerStore((state) => state.upsertPlayer);
  const removePlayer = usePlayerStore((state) => state.removePlayer);
  const renamePlayer = usePlayerStore((state) => state.renamePlayer);
  const getPlayer = usePlayerStore((state) => state.getPlayer);
  const renamePlayerInSession = useSessionStore((state) => state.renamePlayerInSession);

  const [battletag, setBattletag] = useState("");
  const [originalBattletag, setOriginalBattletag] = useState(""); // Track original for rename detection
  const [form, setForm] = useState<Omit<Player, "battletag">>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!editPlayer;

  // Reset form when opening/closing or changing edit target
  useEffect(() => {
    if (isOpen) {
      if (editPlayer) {
        setBattletag(editPlayer.battletag);
        setOriginalBattletag(editPlayer.battletag);
        setForm({ ...editPlayer });
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

    // Battletag: just needs to be non-empty (# discriminator is optional)
    if (!battletag.trim()) {
      errs.push("Battletag/name is required");
    }

    // Check for duplicate: if creating new OR if renaming to a different existing player
    const isRenaming = isEditing && battletag !== originalBattletag;
    if (!isEditing && getPlayer(battletag)) {
      errs.push("A player with this battletag already exists");
    } else if (isRenaming && getPlayer(battletag)) {
      errs.push("A player with this battletag already exists");
    }

    // Must have at least one role willing
    if (form.rolesWilling.length === 0) {
      errs.push("Select at least one role willing to play");
    }

    // Check ranks match roles willing
    for (const role of form.rolesWilling) {
      const stadiumRankField = role === "Tank" ? "tankRank" : role === "DPS" ? "dpsRank" : "supportRank";
      const compRankField = role === "Tank" ? "tankCompRank" : role === "DPS" ? "dpsCompRank" : "supportCompRank";
      if (!form[stadiumRankField] && !form[compRankField] && !form.regularCompRank) {
        errs.push(`${role} requires a Stadium rank or Regular Comp rank`);
      }
    }

    // One-trick validation - at least one hero in pool for any one-trick role
    const oneTrickHeroes = [form.tankOneTrick, form.dpsOneTrick, form.supportOneTrick].filter(Boolean);
    for (const hero of oneTrickHeroes) {
      if (hero && !form.heroPool.includes(hero)) {
        errs.push(`One-trick hero "${hero}" must be in hero pool`);
      }
    }

    // Hero pool - at least 1
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

    // Derive legacy isOneTrick/oneTrickHero from role-specific fields
    const oneTrickHeroes = [form.tankOneTrick, form.dpsOneTrick, form.supportOneTrick].filter(Boolean);
    const derivedIsOneTrick = oneTrickHeroes.length > 0;
    const derivedOneTrickHero = oneTrickHeroes[0] || null;

    const player: Player = {
      battletag,
      ...form,
      // Derive legacy fields for backward compatibility
      isOneTrick: derivedIsOneTrick,
      oneTrickHero: derivedOneTrickHero,
      // Ensure rolePreference matches rolesWilling
      rolePreference: form.rolePreference.filter((r) => form.rolesWilling.includes(r)),
    };

    // If rolePreference is empty or missing roles, fill from rolesWilling
    if (player.rolePreference.length !== player.rolesWilling.length) {
      player.rolePreference = [...player.rolesWilling];
    }

    // Handle rename: if battletag changed, update all references
    const isRenaming = isEditing && battletag !== originalBattletag;
    if (isRenaming) {
      renamePlayer(originalBattletag, battletag);
      renamePlayerInSession(originalBattletag, battletag);
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
      
      // Also update rolePreference to match
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? "Edit Player" : "Add New Player"}
        </h2>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
            <ul className="text-sm text-red-300 list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {/* Battletag */}
          <div>
            <label className="block text-sm font-medium mb-1">Battletag *</label>
            <input
              type="text"
              value={battletag}
              onChange={(e) => setBattletag(e.target.value)}
              placeholder="Name or Name#1234"
              className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 
                focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Roles Willing */}
          <div>
            <label className="block text-sm font-medium mb-1">Roles Willing *</label>
            <div className="flex gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    form.rolesWilling.includes(role)
                      ? role === "Tank"
                        ? "bg-yellow-600"
                        : role === "DPS"
                        ? "bg-red-600"
                        : "bg-green-600"
                      : "bg-gray-600 hover:bg-gray-500"
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
              <label className="block text-sm font-medium mb-1">
                Role Preference (first = most preferred)
              </label>
              <div className="flex gap-2">
                {(form.rolePreference.length === form.rolesWilling.length
                  ? form.rolePreference
                  : form.rolesWilling
                ).map((role, idx, arr) => (
                  <div key={role} className="flex items-center gap-1">
                    <span className="text-gray-400 text-sm">{idx + 1}.</span>
                    <span
                      className={`px-3 py-1 rounded text-sm ${
                        idx === 0 ? "bg-blue-600" : "bg-gray-600"
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
                          className="text-xs text-gray-400 hover:text-white px-1"
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
                          className="text-xs text-gray-400 hover:text-white px-1"
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
              <div className="text-sm font-medium text-gray-300">
                Ranks per Role
                <span className="text-xs text-gray-500 ml-2">
                  (Stadium rank preferred, or use Regular Comp rank as fallback)
                </span>
              </div>
              
              {form.rolesWilling.includes("Tank") && (
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="text-sm font-medium text-yellow-400 mb-2">Tank</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Stadium Rank</label>
                      <select
                        value={form.tankRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, tankRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      >
                        <option value="">None</option>
                        {STADIUM_RANKS.map((rank) => (
                          <option key={rank} value={rank}>{rank}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Regular Comp Rank</label>
                      <select
                        value={form.tankCompRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, tankCompRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      >
                        <option value="">None</option>
                        {COMP_RANKS.map((rank) => (
                          <option key={rank} value={rank}>{rank}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {form.rolesWilling.includes("DPS") && (
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="text-sm font-medium text-red-400 mb-2">DPS</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Stadium Rank</label>
                      <select
                        value={form.dpsRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, dpsRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      >
                        <option value="">None</option>
                        {STADIUM_RANKS.map((rank) => (
                          <option key={rank} value={rank}>{rank}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Regular Comp Rank</label>
                      <select
                        value={form.dpsCompRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, dpsCompRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      >
                        <option value="">None</option>
                        {COMP_RANKS.map((rank) => (
                          <option key={rank} value={rank}>{rank}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {form.rolesWilling.includes("Support") && (
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="text-sm font-medium text-green-400 mb-2">Support</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Stadium Rank</label>
                      <select
                        value={form.supportRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, supportRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      >
                        <option value="">None</option>
                        {STADIUM_RANKS.map((rank) => (
                          <option key={rank} value={rank}>{rank}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Regular Comp Rank</label>
                      <select
                        value={form.supportCompRank || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, supportCompRank: e.target.value || null }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      >
                        <option value="">None</option>
                        {COMP_RANKS.map((rank) => (
                          <option key={rank} value={rank}>{rank}</option>
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
            <label className="block text-sm font-medium mb-1">
              Hero Pool * ({form.heroPool.length} selected)
            </label>
            <div className="space-y-2">
              {ROLES.map((role) => (
                <div key={role}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{role}</span>
                    <button
                      type="button"
                      onClick={() => selectAllHeroesForRole(role)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => clearHeroesForRole(role)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {HEROES_BY_ROLE[role].map((hero) => (
                      <button
                        key={hero}
                        onClick={() => toggleHero(hero)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          form.heroPool.includes(hero)
                            ? "bg-blue-600"
                            : "bg-gray-600 hover:bg-gray-500"
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
              <div className="text-sm font-medium text-gray-300">
                One-Trick Heroes
                <span className="text-xs text-gray-500 ml-2">
                  (Select if player only plays one hero for a role)
                </span>
              </div>
              
              {form.rolesWilling.includes("Tank") && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-yellow-400 w-16">Tank:</span>
                  <select
                    value={form.tankOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, tankOneTrick: e.target.value || null }))
                    }
                    className="flex-1 px-3 py-1.5 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
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
                  <span className="text-sm text-red-400 w-16">DPS:</span>
                  <select
                    value={form.dpsOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dpsOneTrick: e.target.value || null }))
                    }
                    className="flex-1 px-3 py-1.5 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
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
                  <span className="text-sm text-green-400 w-16">Support:</span>
                  <select
                    value={form.supportOneTrick || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, supportOneTrick: e.target.value || null }))
                    }
                    className="flex-1 px-3 py-1.5 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
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
            <label className="block text-sm font-medium mb-1">
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
            <div className="flex justify-between text-xs text-gray-400">
              <span>-500 (weaker)</span>
              <span>0</span>
              <span>+500 (stronger)</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={form.notes || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value || null }))
              }
              placeholder="Optional notes about this player..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-700">
          <div>
            {isEditing && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete Player
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-300">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {isEditing ? "Save Changes" : "Add Player"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
