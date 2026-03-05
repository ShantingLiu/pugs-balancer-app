import { describe, it, expect } from "vitest";
import { parsePlayersCSV } from "@utils/csvParser";

describe("csvParser", () => {
  describe("parsePlayersCSV", () => {
    it("should parse valid CSV with all fields", () => {
      const csv = `battletag,tank_rank,dps_rank,support_rank,roles_willing,role_preference,hero_pool,is_one_trick,one_trick_hero,regular_comp_rank,weight_modifier,notes
Player1#1234,Pro 2,Elite 3,Contender 1,"Tank,DPS","Tank,DPS","Reinhardt,D.Va",false,,,0,Test player`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].battletag).toBe("Player1#1234");
      expect(result.valid[0].tankRank).toBe("Pro 2");
      expect(result.valid[0].rolesWilling).toEqual(["Tank", "DPS"]);
      expect(result.valid[0].heroPool).toEqual(["Reinhardt", "D.Va"]);
    });

    it("should return error for missing battletag", () => {
      const csv = `battletag,tank_rank,roles_willing
,Pro 2,"Tank"`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("battletag");
      expect(result.errors[0].message).toContain("required");
    });

    it("should return error for invalid battletag format", () => {
      const csv = `battletag,tank_rank,roles_willing
InvalidName,Pro 2,"Tank"`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Invalid battletag format");
    });

    it("should return error for missing roles_willing", () => {
      const csv = `battletag,tank_rank,roles_willing
Player1#1234,Pro 2,`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("roles_willing");
      expect(result.errors[0].message).toContain("at least one role");
    });

    it("should return error when one_trick is true but no hero specified", () => {
      const csv = `battletag,tank_rank,roles_willing,is_one_trick,one_trick_hero
Player1#1234,Pro 2,"Tank",true,`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("one_trick_hero");
      expect(result.errors[0].message).toContain("One-trick hero required");
    });

    it("should warn for unknown hero", () => {
      const csv = `battletag,tank_rank,roles_willing,hero_pool
Player1#1234,Pro 2,"Tank","FakeHero"`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.warnings.some((w) => w.message.includes("Unknown hero"))).toBe(true);
    });

    it("should warn when no rank available for willing role", () => {
      const csv = `battletag,roles_willing
Player1#1234,"Tank"`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.message.includes("No rank for Tank"))).toBe(true);
    });

    it("should handle semicolon delimiter", () => {
      const csv = `battletag;tank_rank;roles_willing
Player1#1234;Pro 2;Tank`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].tankRank).toBe("Pro 2");
    });

    it("should handle quoted fields with commas", () => {
      const csv = `battletag,roles_willing,hero_pool
Player1#1234,"Tank,DPS,Support","Reinhardt,D.Va,Soldier: 76"`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.valid[0].rolesWilling).toEqual(["Tank", "DPS", "Support"]);
      expect(result.valid[0].heroPool).toEqual(["Reinhardt", "D.Va", "Soldier: 76"]);
    });

    it("should use role_preference from CSV or default to roles_willing", () => {
      const csv = `battletag,roles_willing,role_preference
Player1#1234,"Tank,DPS,Support","Support,DPS,Tank"`;

      const result = parsePlayersCSV(csv);

      expect(result.valid[0].rolePreference).toEqual(["Support", "DPS", "Tank"]);
    });

    it("should parse multiple valid rows", () => {
      const csv = `battletag,tank_rank,roles_willing
Player1#1234,Pro 2,"Tank"
Player2#5678,Elite 1,"DPS"
Player3#9012,Contender 3,"Support"`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(3);
    });

    it("should continue parsing valid rows even with errors", () => {
      const csv = `battletag,tank_rank,roles_willing
Player1#1234,Pro 2,"Tank"
InvalidPlayer,Elite 1,"DPS"
Player3#9012,Contender 3,"Support"`;

      const result = parsePlayersCSV(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.valid).toHaveLength(2);
    });
  });
});
