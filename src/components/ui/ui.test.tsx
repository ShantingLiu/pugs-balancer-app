import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Label } from "./label";
import { Separator } from "./separator";
import { Checkbox } from "./checkbox";
import { Slider } from "./slider";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog";
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "./select";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./tooltip";
import { Toaster } from "./sonner";
import { SearchIcon, FolderIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "./alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./table";
import {
  Field,
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldTitle,
  FieldDescription,
  FieldError,
  FieldContent,
  FieldSeparator,
} from "./field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "./empty";
import { Spinner } from "./spinner";

describe("ui kit primitives", () => {
  it("renders Button variants, shapes, and Base UI render composition", () => {
    render(
      <div>
        <Button variant="primary" size="sm" shape="well">
          Primary
        </Button>
        <Button
          variant="danger"
          render={<a href="#delete" />}
          nativeButton={false}
        >
          Link Button
        </Button>
      </div>
    );

    const btn = screen.getByRole("button", { name: "Primary" });
    expect(btn).toHaveClass("app-primary", "rounded-well");
    expect(btn).toHaveAttribute("type", "button");

    const link = screen.getByRole("button", { name: "Link Button" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "#delete");
    expect(link).toHaveClass("app-danger", "rounded-pill");
    expect(link).not.toHaveAttribute("type");
  });

  it("renders Badge semantic/role variants and render prop composition", () => {
    render(
      <div>
        <Badge variant="tank">Tank</Badge>
        <Badge variant="dps">DPS</Badge>
        <Badge variant="support">Support</Badge>
        <Badge variant="pink">Pink Chip</Badge>
        <Badge variant="ok">Ready</Badge>
        <Badge variant="sky" render={<a href="#chip" />}>
          Chip Link
        </Badge>
      </div>
    );

    expect(screen.getByText("Tank")).toHaveClass("role-tank");
    expect(screen.getByText("DPS")).toHaveClass("role-dps");
    expect(screen.getByText("Support")).toHaveClass("role-support");
    expect(screen.getByText("Pink Chip")).toHaveClass("app-chip--pink");
    expect(screen.getByText("Ready")).toHaveClass("bg-ok-soft");
    expect(screen.getByRole("link", { name: "Chip Link" })).toHaveClass(
      "app-chip--sky"
    );
  });

  it("renders Card variants and subcomponents", () => {
    render(
      <Card variant="team1" data-testid="team-card">
        <CardHeader>
          <CardTitle>Team 1</CardTitle>
          <CardDescription>Berry Rose</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );

    expect(screen.getByTestId("team-card")).toHaveClass("app-team-1");
    expect(screen.getByText("Team 1")).toBeInTheDocument();
    expect(screen.getByText("Berry Rose")).toBeInTheDocument();
  });

  it("renders Input, Textarea, Label, and Separator", () => {
    render(
      <div>
        <Label htmlFor="player-name">Name</Label>
        <Input id="player-name" placeholder="Player#1234" />
        <Textarea aria-label="Notes" placeholder="Notes..." />
        <Separator />
      </div>
    );

    expect(screen.getByLabelText("Name")).toHaveClass("app-input");
    expect(screen.getByLabelText("Notes")).toHaveClass("app-input");
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("supports Checkbox aria-label and checked state", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Hard constraint"
        defaultChecked={false}
        onCheckedChange={onCheckedChange}
      />
    );

    const checkbox = screen.getByRole("checkbox", { name: "Hard constraint" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAttribute("data-checked");
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.any(Object));
  });

  it("renders Slider with both scalar and array values", () => {
    render(
      <div>
        <Slider
          aria-label="Weight override"
          defaultValue={50}
          min={-500}
          max={500}
          step={10}
        />
        <Slider
          aria-label="SR range"
          defaultValue={[20, 80]}
          min={0}
          max={100}
        />
      </div>
    );

    const scalarSlider = screen.getByRole("slider", {
      name: "Weight override",
    });
    expect(scalarSlider).toHaveAttribute("aria-valuenow", "50");

    const rangeSliders = screen.getAllByRole("slider", { name: "SR range" });
    expect(rangeSliders).toHaveLength(2);
    expect(rangeSliders[0]).toHaveAttribute("aria-valuenow", "20");
    expect(rangeSliders[1]).toHaveAttribute("aria-valuenow", "80");
  });

  it("renders Dialog with close button aria-label='Close' by default", () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger render={<Button />}>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>Update player details</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>
              Cancel
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toHaveClass("app-modal");
    expect(screen.getByText("Edit Player")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders AlertDialog confirmation flow", () => {
    const onConfirm = vi.fn();
    render(
      <AlertDialog defaultOpen>
        <AlertDialogTrigger render={<Button />}>Switch</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Mode?</AlertDialogTitle>
            <AlertDialogDescription>Resets session stats.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={onConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    expect(screen.getByRole("alertdialog")).toHaveClass("app-modal");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
      "app-secondary"
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders Select trigger with items map and portaled options", () => {
    const onValueChange = vi.fn();
    const sortItems = [
      { value: "name", label: "Sort: Name" },
      { value: "rank-desc", label: "Sort: Rank" },
    ];
    render(
      <Select
        items={sortItems}
        defaultValue="name"
        onValueChange={onValueChange}
      >
        <SelectTrigger aria-label="Sort players">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Sort</SelectLabel>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectSeparator />
            <SelectItem value="rank-desc">Sort: Rank</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByRole("combobox", { name: "Sort players" });
    expect(trigger).toHaveClass("app-input");
    expect(trigger).toHaveTextContent("Sort: Name");
    fireEvent.click(trigger);

    const option = screen.getByRole("option", { name: "Sort: Rank" });
    fireEvent.pointerDown(option);
    fireEvent.click(option);
    expect(onValueChange).toHaveBeenCalledWith(
      "rank-desc",
      expect.any(Object)
    );
  });

  it("renders Popover content when opened", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger render={<Button />}>Weight</PopoverTrigger>
        <PopoverContent>Weight Controls</PopoverContent>
      </Popover>
    );

    expect(screen.getByText("Weight Controls")).toHaveClass("app-modal");
  });

  it("renders Tabs and switches active content", () => {
    render(
      <Tabs defaultValue="balance">
        <TabsList>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="draft" activeVariant="sky">
            Draft
          </TabsTrigger>
        </TabsList>
        <TabsContent value="balance">Balance Panel</TabsContent>
        <TabsContent value="draft">Draft Panel</TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Balance Panel")).toBeVisible();
    const draftTab = screen.getByRole("tab", { name: "Draft" });
    expect(draftTab).toHaveClass("app-tab-sky");
    fireEvent.click(draftTab);
    expect(screen.getByText("Draft Panel")).toBeVisible();
  });

  it("renders ToggleGroup activeVariants (primary, sky, ok, bad, none) with array values", () => {
    const onChange = vi.fn();
    render(
      <div>
        <ToggleGroup value={["light"]} onValueChange={onChange}>
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark" activeVariant="sky">
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup defaultValue={["together"]}>
          <ToggleGroupItem value="together" activeVariant="ok">
            Together
          </ToggleGroupItem>
          <ToggleGroupItem value="apart" activeVariant="bad">
            Apart
          </ToggleGroupItem>
          <ToggleGroupItem
            value="custom"
            activeVariant="none"
            className="role-dps"
          >
            Custom
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith(["dark"], expect.any(Object));
    const togetherBtn = screen.getByRole("button", { name: "Together" });
    expect(togetherBtn).toHaveClass("app-tab-ok");
    expect(togetherBtn).toHaveAttribute("data-pressed");
    expect(screen.getByRole("button", { name: "Apart" })).toHaveClass(
      "app-tab-bad"
    );
    const custom = screen.getByRole("button", { name: "Custom" });
    expect(custom).toHaveClass("role-dps");
    expect(custom).not.toHaveClass(
      "app-tab-primary",
      "app-tab-sky",
      "app-tab-ok",
      "app-tab-bad"
    );
  });

  it("renders Tooltip safely WITHOUT an outer TooltipProvider", () => {
    expect(() =>
      render(
        <Tooltip>
          <TooltipTrigger render={<Button />}>Hover me</TooltipTrigger>
          <TooltipContent>Helpful tip</TooltipContent>
        </Tooltip>
      )
    ).not.toThrow();

    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger render={<Button />}>With Provider</TooltipTrigger>
          <TooltipContent>Provider tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent("Provider tip");
  });

  it("renders Toaster, Alert variants, and Table", () => {
    render(
      <div>
        <Toaster />
        <Alert variant="warn">
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>Check constraints</AlertDescription>
        </Alert>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Wins</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Swoo</TableCell>
              <TableCell>12</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );

    expect(screen.getByRole("alert")).toHaveClass("bg-warn-soft");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Swoo")).toBeInTheDocument();
  });

  it("exposes standard data-slot attributes and data-icon button support", () => {
    render(
      <Button size="sm">
        <SearchIcon data-icon="inline-start" aria-hidden="true" />
        Find
      </Button>
    );

    const btn = screen.getByRole("button", { name: "Find" });
    expect(btn).toHaveAttribute("data-slot", "button");
    expect(btn.querySelector("[data-icon='inline-start']")).toBeInTheDocument();
  });

  it("renders Field, FieldGroup, FieldSet, FieldLegend, FieldContent, FieldSeparator, and FieldError", () => {
    render(
      <FieldSet>
        <FieldLegend variant="label">Player Info</FieldLegend>
        <FieldGroup>
          <Field orientation="vertical" data-invalid>
            <FieldLabel htmlFor="btag">BattleTag</FieldLabel>
            <Input id="btag" aria-invalid />
            <FieldDescription>Include # and digits.</FieldDescription>
            <FieldError
              errors={[
                { message: "BattleTag is required" },
                { message: "BattleTag is required" },
              ]}
            />
          </Field>
          <FieldSeparator>OR</FieldSeparator>
          <Field orientation="horizontal" data-disabled>
            <FieldContent>
              <FieldTitle>Locked Role</FieldTitle>
              <FieldDescription>Managed by captain.</FieldDescription>
            </FieldContent>
            <Checkbox aria-label="Locked Role" disabled />
          </Field>
        </FieldGroup>
      </FieldSet>
    );

    const input = screen.getByLabelText("BattleTag");
    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "BattleTag is required"
    );
    expect(screen.getByText("OR")).toHaveAttribute(
      "data-slot",
      "field-separator-content"
    );
    expect(screen.getByText("Locked Role")).toHaveAttribute(
      "data-slot",
      "field-label"
    );
  });

  it("renders InputGroup with addons, buttons, text, input, and textarea", () => {
    const onClear = vi.fn();
    render(
      <div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <SearchIcon aria-hidden="true" />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput aria-label="Search players" placeholder="Search..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton onClick={onClear}>Clear</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupTextarea aria-label="Match notes" placeholder="Notes..." />
        </InputGroup>
      </div>
    );

    const searchInput = screen.getByLabelText("Search players");
    expect(searchInput).toHaveAttribute("data-slot", "input-group-control");
    expect(screen.getByLabelText("Match notes")).toHaveAttribute(
      "data-slot",
      "input-group-control"
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders Empty composition and Spinner with status semantics", () => {
    render(
      <div>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No players yet</EmptyTitle>
            <EmptyDescription>Import a CSV or add a player.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button disabled>
              <Spinner data-icon="inline-start" />
              Loading...
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );

    expect(screen.getByText("No players yet")).toHaveAttribute(
      "data-slot",
      "empty-title"
    );
    expect(screen.getByText("Import a CSV or add a player.")).toHaveAttribute(
      "data-slot",
      "empty-description"
    );
    const spinner = screen.getByRole("status", { name: "Loading" });
    expect(spinner).toHaveAttribute("data-slot", "spinner");
    expect(spinner).toHaveClass("animate-spin");
  });
});
