import type { Player } from "@engine/types";

// ---------------------------------------------------------------------------
// Column definitions (§5.1)
// ---------------------------------------------------------------------------

export const SHEET_COLUMNS = [
  { header: "BattleTag", field: "battletag", required: true },
  { header: "Roles", field: "rolesWilling", required: true },
  { header: "Role Preference", field: "rolePreference", required: false },
  { header: "Tank Rank (Stadium)", field: "tankRank", required: false },
  { header: "DPS Rank (Stadium)", field: "dpsRank", required: false },
  { header: "Support Rank (Stadium)", field: "supportRank", required: false },
  { header: "Tank Rank (Comp)", field: "tankCompRank", required: false },
  { header: "DPS Rank (Comp)", field: "dpsCompRank", required: false },
  { header: "Support Rank (Comp)", field: "supportCompRank", required: false },
  { header: "Comp Rank (Global)", field: "regularCompRank", required: false },
  { header: "Hero Pool", field: "heroPool", required: false },
  { header: "Tank One-Trick", field: "tankOneTrick", required: false },
  { header: "DPS One-Trick", field: "dpsOneTrick", required: false },
  { header: "Support One-Trick", field: "supportOneTrick", required: false },
  { header: "Weight Modifier", field: "weightModifier", required: false },
  { header: "Notes", field: "notes", required: false },
  { header: "Stadium Wins", field: "stadiumWins", required: false },
  { header: "Regular 5v5 Wins", field: "regular5v5Wins", required: false },
  { header: "Regular 6v6 Wins", field: "regular6v6Wins", required: false },
] as const;

export const HEADER_TO_FIELD = new Map(
  SHEET_COLUMNS.map((c) => [c.header, c.field]),
);

export const FIELD_TO_HEADER = new Map(
  SHEET_COLUMNS.map((c) => [c.field, c.header]),
);

// ---------------------------------------------------------------------------
// Serialization (§5.1)
// ---------------------------------------------------------------------------

export function serializePlayerToRow(player: Player): string[] {
  return SHEET_COLUMNS.map((col) => {
    const value = (player as unknown as Record<string, unknown>)[col.field];
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(",");
    return String(value);
  });
}

// ---------------------------------------------------------------------------
// Template creation (§5.2)
// ---------------------------------------------------------------------------

export function buildTemplateRequest(title: string): object {
  return {
    properties: { title },
    sheets: [
      {
        properties: {
          title: "Roster",
          gridProperties: { frozenRowCount: 1 },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: SHEET_COLUMNS.map((col) => ({
                  userEnteredValue: { stringValue: col.header },
                  userEnteredFormat: {
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                    backgroundColor: col.header.includes("Stadium")
                      ? { red: 0.2, green: 0.3, blue: 0.5 }
                      : col.header.includes("Comp") &&
                          !col.header.includes("Global")
                        ? { red: 0.2, green: 0.5, blue: 0.3 }
                        : col.header.includes("Global")
                          ? { red: 0.3, green: 0.35, blue: 0.4 }
                          : { red: 0.15, green: 0.15, blue: 0.15 },
                  },
                })),
              },
              ...buildExampleRows(),
            ],
          },
        ],
      },
      {
        properties: { title: "Info" },
        data: [
          {
            rowData: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        "PUGs Balancer — Google Sheets Roster",
                    },
                  },
                ],
              },
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        "Delete the example rows on the Roster tab before use.",
                    },
                  },
                ],
              },
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        "Do not rename or move the headers. You may add extra columns to the right.",
                    },
                  },
                ],
              },
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        "Valid Stadium tiers: Rookie, Novice, Contender, Elite, Pro, All-Star, Legend (sub-rank 1-5)",
                    },
                  },
                ],
              },
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        "Valid Comp tiers: Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Champion (sub-rank 1-5)",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Example rows (§5.2)
// ---------------------------------------------------------------------------

const EXAMPLE_PLAYERS = [
  {
    battletag: "Example#1234",
    rolesWilling: "Tank,DPS",
    rolePreference: "Tank,DPS",
    tankRank: "Pro 2",
    dpsRank: "Elite 3",
    supportRank: "",
    tankCompRank: "Diamond 1",
    dpsCompRank: "Master 3",
    supportCompRank: "",
    regularCompRank: "Diamond 2",
    heroPool: "Reinhardt,D.Va,Zarya",
    tankOneTrick: "",
    dpsOneTrick: "",
    supportOneTrick: "",
    weightModifier: "0",
    notes: "Main tank player",
    stadiumWins: "5",
    regular5v5Wins: "3",
    regular6v6Wins: "0",
  },
  {
    battletag: "Example#5678",
    rolesWilling: "DPS,Support",
    rolePreference: "Support,DPS",
    tankRank: "",
    dpsRank: "Pro 1",
    supportRank: "All-Star 2",
    tankCompRank: "",
    dpsCompRank: "Master 1",
    supportCompRank: "Grandmaster 3",
    regularCompRank: "Master 2",
    heroPool: "Ana,Kiriko,Ashe",
    tankOneTrick: "",
    dpsOneTrick: "",
    supportOneTrick: "",
    weightModifier: "0",
    notes: "Flex support",
    stadiumWins: "2",
    regular5v5Wins: "1",
    regular6v6Wins: "0",
  },
];

function getExampleValue(field: string, index: number): string {
  return (EXAMPLE_PLAYERS[index] as Record<string, string>)[field] ?? "";
}

function buildExampleRows(): object[] {
  return [
    {
      values: SHEET_COLUMNS.map((col) => ({
        userEnteredValue: { stringValue: getExampleValue(col.field, 0) },
        note:
          col.field === "battletag"
            ? "← Delete these example rows"
            : undefined,
      })),
    },
    {
      values: SHEET_COLUMNS.map((col) => ({
        userEnteredValue: { stringValue: getExampleValue(col.field, 1) },
      })),
    },
  ];
}

// ---------------------------------------------------------------------------
// Data validation / dropdowns (§5.3)
// ---------------------------------------------------------------------------

export function buildDataValidationRequests(sheetId: number): object[] {
  const requests: object[] = [];

  const roleCombos = [
    "Tank",
    "DPS",
    "Support",
    "Tank,DPS",
    "Tank,Support",
    "DPS,Support",
    "Tank,DPS,Support",
  ];
  requests.push(buildDropdownValidation(sheetId, 1, roleCombos));

  const stadiumTiers = [
    "Rookie",
    "Novice",
    "Contender",
    "Elite",
    "Pro",
    "All-Star",
    "Legend",
  ];
  const stadiumRanks = generateRankOptions(stadiumTiers);
  for (let col = 3; col <= 5; col++) {
    requests.push(buildDropdownValidation(sheetId, col, stadiumRanks));
  }

  const compTiers = [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Master",
    "Grandmaster",
    "Champion",
  ];
  const compRanks = generateRankOptions(compTiers);
  for (let col = 6; col <= 9; col++) {
    requests.push(buildDropdownValidation(sheetId, col, compRanks));
  }

  return requests;
}

function generateRankOptions(tiers: string[]): string[] {
  return tiers.flatMap((t) => [1, 2, 3, 4, 5].map((s) => `${t} ${s}`));
}

function buildDropdownValidation(
  sheetId: number,
  colIndex: number,
  options: string[],
): object {
  return {
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1,
        startColumnIndex: colIndex,
        endColumnIndex: colIndex + 1,
      },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: options.map((v) => ({ userEnteredValue: v })),
        },
        showCustomUi: true,
        strict: false,
      },
    },
  };
}
