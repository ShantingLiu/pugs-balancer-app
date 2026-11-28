import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { Player, Role } from "@engine/types";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import { getHeroesByRole } from "@utils/heroUtils";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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

const STADIUM_RANK_ITEMS: { value: string | null; label: string }[] = [
  { value: null, label: "None" },
  ...STADIUM_RANKS.map((rank) => ({ value: rank, label: rank })),
];

const COMP_RANK_ITEMS: { value: string | null; label: string }[] = [
  { value: null, label: "None" },
  ...COMP_RANKS.map((rank) => ({ value: rank, label: rank })),
];

const ROLE_CONFIG = [
  {
    role: "Tank" as const,
    stadiumField: "tankRank" as const,
    compField: "tankCompRank" as const,
    oneTrickField: "tankOneTrick" as const,
    textClass: "text-tank",
    selectedClass: "bg-yellow-600",
  },
  {
    role: "DPS" as const,
    stadiumField: "dpsRank" as const,
    compField: "dpsCompRank" as const,
    oneTrickField: "dpsOneTrick" as const,
    textClass: "text-dps",
    selectedClass: "role-dps",
  },
  {
    role: "Support" as const,
    stadiumField: "supportRank" as const,
    compField: "supportCompRank" as const,
    oneTrickField: "supportOneTrick" as const,
    textClass: "text-sup",
    selectedClass: "role-support",
  },
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

  const [battletag, setBattletag] = useState(() =>
    isOpen && editPlayer ? editPlayer.battletag : ""
  );
  const [originalBattletag, setOriginalBattletag] = useState(() =>
    isOpen && editPlayer ? editPlayer.battletag : ""
  );
  const [form, setForm] = useState<Omit<Player, "battletag">>(() =>
    isOpen && editPlayer ? { ...editPlayer } : EMPTY_FORM
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeEditPlayer, setActiveEditPlayer] = useState<Player | null>(() =>
    editPlayer ?? null
  );
  const [prevProps, setPrevProps] = useState({ isOpen, editPlayer });

  if (isOpen !== prevProps.isOpen || editPlayer !== prevProps.editPlayer) {
    setPrevProps({ isOpen, editPlayer });
    if (isOpen) {
      setActiveEditPlayer(editPlayer ?? null);
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
  }

  const isEditing = !!activeEditPlayer;

  const HEROES_BY_ROLE = useMemo<Record<Role, string[]>>(
    () => ({
      Tank: getHeroesByRole("Tank"),
      DPS: getHeroesByRole("DPS"),
      Support: getHeroesByRole("Support"),
    }),
    []
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
    if (activeEditPlayer) {
      removePlayer(activeEditPlayer.battletag);
      onClose();
    }
  };

  const handleRolesChange = (nextRoles: Role[]) => {
    setForm((prev) => {
      const added = nextRoles.filter((r) => !prev.rolesWilling.includes(r));
      const newPref = [
        ...prev.rolePreference.filter((r) => nextRoles.includes(r)),
        ...added.filter((r) => !prev.rolePreference.includes(r)),
      ];

      return {
        ...prev,
        rolesWilling: nextRoles,
        rolePreference: newPref,
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

  const battletagInvalid = errors.some(
    (e) => e.includes("Battletag") || e.includes("battletag")
  );
  const rolesInvalid = errors.some((e) => e.includes("at least one role"));
  const heroPoolInvalid = errors.some((e) => e.includes("hero pool"));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? "Edit Player" : "Add New Player"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing
              ? "Edit player details, roles, ranks, and hero pool."
              : "Add a new player with roles, ranks, and hero pool."}
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <Alert variant="bad">
            <AlertDescription className="text-bad">
              <ul className="list-disc list-inside flex flex-col gap-0.5">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <FieldGroup className="gap-4">
          {/* Battletag */}
          <Field data-invalid={battletagInvalid || undefined} className="gap-1.5">
            <FieldLabel htmlFor="add-player-battletag">Battletag *</FieldLabel>
            <Input
              id="add-player-battletag"
              type="text"
              value={battletag}
              onChange={(e) => setBattletag(e.target.value)}
              placeholder="Name or Name#1234"
              aria-invalid={battletagInvalid || undefined}
            />
          </Field>

          {/* Roles Willing */}
          <FieldSet className="gap-1.5">
            <FieldLegend
              variant="label"
              className={cn("mb-0", rolesInvalid && "text-destructive")}
            >
              Roles Willing *
            </FieldLegend>
            <Field data-invalid={rolesInvalid || undefined} className="w-fit gap-1">
              <ToggleGroup
                multiple
                value={form.rolesWilling}
                onValueChange={handleRolesChange}
                aria-label="Roles Willing"
                size="default"
                className="flex-wrap gap-1.5"
              >
                {ROLE_CONFIG.map(({ role, selectedClass }) => {
                  const isSelected = form.rolesWilling.includes(role);
                  return (
                    <ToggleGroupItem
                      key={role}
                      value={role}
                      activeVariant="none"
                      className={cn(
                        "px-4 py-1.5",
                        isSelected
                          ? selectedClass
                          : "text-ink-2 hover:bg-sky-soft"
                      )}
                    >
                      {role}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </Field>
          </FieldSet>

          {/* Role Preference Order */}
          {form.rolesWilling.length > 1 && (
            <Field className="gap-1.5">
              <FieldTitle>Role Preference (first = most preferred)</FieldTitle>
              <div className="flex flex-wrap gap-2.5">
                {(form.rolePreference.length === form.rolesWilling.length
                  ? form.rolePreference
                  : form.rolesWilling
                ).map((role, idx, arr) => (
                  <div key={role} className="flex items-center gap-1">
                    <span className="text-muted text-sm app-measured">{idx + 1}.</span>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-pill text-sm font-semibold border",
                        idx === 0
                          ? "bg-pink-soft border-pink-edge text-pink-ink"
                          : "bg-paper-3 border-rule text-ink-2"
                      )}
                    >
                      {role}
                    </span>
                    <div className="flex flex-col">
                      {idx > 0 && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            const newPref = [...arr];
                            [newPref[idx - 1], newPref[idx]] = [newPref[idx], newPref[idx - 1]];
                            setForm((prev) => ({ ...prev, rolePreference: newPref }));
                          }}
                          className="text-muted hover:text-ink"
                          title="Move up"
                          aria-label={`Move ${role} up`}
                        >
                          <ChevronUp aria-hidden="true" />
                        </Button>
                      )}
                      {idx < arr.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            const newPref = [...arr];
                            [newPref[idx], newPref[idx + 1]] = [newPref[idx + 1], newPref[idx]];
                            setForm((prev) => ({ ...prev, rolePreference: newPref }));
                          }}
                          className="text-muted hover:text-ink"
                          title="Move down"
                          aria-label={`Move ${role} down`}
                        >
                          <ChevronDown aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          )}

          {/* Ranks - Per Role + Shared 6v6 */}
          {form.rolesWilling.length > 0 && (
            <FieldSet className="gap-3">
              <div className="flex flex-col gap-0.5">
                <FieldLegend variant="label" className="mb-0">
                  Ranks per Role
                </FieldLegend>
                <FieldDescription>
                  Stadium or 5v5 Comp rank
                </FieldDescription>
              </div>

              {ROLE_CONFIG.filter(({ role }) => form.rolesWilling.includes(role)).map(
                ({ role, stadiumField, compField, textClass }) => {
                  const roleRankInvalid = errors.some((e) =>
                    e.startsWith(`${role} requires`)
                  );
                  const stadiumId = `add-player-${role.toLowerCase()}-stadium-rank`;
                  const compId = `add-player-${role.toLowerCase()}-comp-rank`;
                  return (
                    <div key={role} className="p-3 app-well">
                      <div className={cn("text-sm font-semibold mb-2", textClass)}>{role}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field
                          data-invalid={roleRankInvalid || undefined}
                          className="gap-1"
                        >
                          <FieldLabel
                            htmlFor={stadiumId}
                            className="text-xs font-normal text-muted"
                          >
                            Stadium Rank
                          </FieldLabel>
                          <Select
                            items={STADIUM_RANK_ITEMS}
                            value={form[stadiumField]}
                            onValueChange={(val) =>
                              setForm((prev) => ({
                                ...prev,
                                [stadiumField]: val,
                              }))
                            }
                          >
                            <SelectTrigger
                              id={stadiumId}
                              aria-label={`${role} Stadium Rank`}
                              aria-invalid={roleRankInvalid || undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {STADIUM_RANK_ITEMS.map((item) => (
                                  <SelectItem key={item.value ?? "__none__"} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field
                          data-invalid={roleRankInvalid || undefined}
                          className="gap-1"
                        >
                          <FieldLabel
                            htmlFor={compId}
                            className="text-xs font-normal text-muted"
                          >
                            5v5 Comp Rank
                          </FieldLabel>
                          <Select
                            items={COMP_RANK_ITEMS}
                            value={form[compField]}
                            onValueChange={(val) =>
                              setForm((prev) => ({
                                ...prev,
                                [compField]: val,
                              }))
                            }
                          >
                            <SelectTrigger
                              id={compId}
                              aria-label={`${role} 5v5 Comp Rank`}
                              aria-invalid={roleRankInvalid || undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {COMP_RANK_ITEMS.map((item) => (
                                  <SelectItem key={item.value ?? "__none__"} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  );
                }
              )}

              <div className="p-3 app-well">
                <Field className="gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel
                      htmlFor="player-6v6-rank"
                      className="text-sm font-semibold text-ink-2"
                    >
                      6v6 Comp Rank
                    </FieldLabel>
                    <span className="text-xs text-muted">
                      Shared across all roles (no role lock)
                    </span>
                  </div>
                  <Select
                    items={COMP_RANK_ITEMS}
                    value={form.regular6v6Rank}
                    onValueChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        regular6v6Rank: val,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="player-6v6-rank"
                      aria-label="6v6 Comp Rank"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {COMP_RANK_ITEMS.map((item) => (
                          <SelectItem key={item.value ?? "__none__"} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldSet>
          )}

          {/* Hero Pool */}
          <FieldSet className="gap-2">
            <FieldLegend
              variant="label"
              className={cn("mb-0", heroPoolInvalid && "text-destructive")}
            >
              Hero Pool * ({form.heroPool.length} selected)
            </FieldLegend>
            <div className="flex flex-col gap-3">
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
                        className={cn(
                          "px-2.5 py-1 rounded-pill text-xs font-semibold border",
                          form.heroPool.includes(hero)
                            ? "bg-pink-soft border-pink-edge text-pink-ink"
                            : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft"
                        )}
                      >
                        {hero}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FieldSet>

          {/* One-trick per role */}
          {form.rolesWilling.length > 0 && (
            <FieldSet className="gap-2.5">
              <div className="flex flex-col gap-0.5">
                <FieldLegend variant="label" className="mb-0">
                  One-Trick Heroes
                </FieldLegend>
                <FieldDescription>
                  Select if player only plays one hero for a role
                </FieldDescription>
              </div>

              {ROLE_CONFIG.filter(({ role }) => form.rolesWilling.includes(role)).map(
                ({ role, oneTrickField, textClass }) => {
                  const oneTrickHero = form[oneTrickField];
                  const oneTrickInvalid = Boolean(
                    oneTrickHero && errors.some((e) => e.includes(`"${oneTrickHero}"`))
                  );
                  const oneTrickId = `add-player-${role.toLowerCase()}-onetrick`;
                  const oneTrickItems: { value: string | null; label: string }[] = [
                    { value: null, label: "Not a one-trick" },
                    ...HEROES_BY_ROLE[role]
                      .filter((h) => form.heroPool.includes(h))
                      .map((hero) => ({ value: hero, label: hero })),
                  ];
                  return (
                    <Field
                      key={role}
                      orientation="horizontal"
                      data-invalid={oneTrickInvalid || undefined}
                      className="gap-3"
                    >
                      <FieldLabel
                        htmlFor={oneTrickId}
                        className={cn("w-16 shrink-0 flex-none", textClass)}
                      >
                        {role}
                      </FieldLabel>
                      <Select
                        items={oneTrickItems}
                        value={form[oneTrickField]}
                        onValueChange={(val) =>
                          setForm((prev) => ({
                            ...prev,
                            [oneTrickField]: val,
                          }))
                        }
                      >
                        <SelectTrigger
                          id={oneTrickId}
                          size="sm"
                          className="flex-1"
                          aria-label={`${role} One-Trick Hero`}
                          aria-invalid={oneTrickInvalid || undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {oneTrickItems.map((item) => (
                              <SelectItem key={item.value ?? "__none__"} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  );
                }
              )}
            </FieldSet>
          )}

          {/* Weight Modifier */}
          <Field className="gap-2">
            <FieldLabel id="add-player-weight-label">
              Weight Modifier (
              <span className="app-measured">
                {form.weightModifier > 0 ? "+" : ""}
                {form.weightModifier}
              </span>
              )
            </FieldLabel>
            <Slider
              aria-labelledby="add-player-weight-label"
              min={-500}
              max={500}
              step={50}
              value={form.weightModifier}
              onValueChange={(val) => {
                const next = typeof val === "number" ? val : val[0];
                setForm((prev) => ({ ...prev, weightModifier: next }));
              }}
            />
            <div className="flex justify-between text-xs text-muted app-measured">
              <span>-500 (weaker)</span>
              <span>0</span>
              <span>+500 (stronger)</span>
            </div>
          </Field>

          {/* Notes */}
          <Field className="gap-1.5">
            <FieldLabel htmlFor="add-player-notes">Notes</FieldLabel>
            <Textarea
              id="add-player-notes"
              value={form.notes || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value || null }))
              }
              placeholder="Optional notes about this player..."
              rows={2}
              className="min-h-0 resize-none"
            />
          </Field>
        </FieldGroup>

        {/* Actions */}
        <Separator />
        <DialogFooter className="flex-wrap sm:justify-between gap-3">
          <div>
            {isEditing && !showDeleteConfirm && (
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                Delete Player
              </Button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-bad font-semibold">Are you sure?</span>
                <Button variant="danger" size="sm" onClick={handleDelete}>
                  Yes, delete
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {isEditing ? "Save Changes" : "Add Player"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
