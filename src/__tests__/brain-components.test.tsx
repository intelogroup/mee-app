import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TraitConnectionGraph from "@/components/TraitConnectionGraph";
import PatternInsights from "@/components/PatternInsights";

const MOCK_TRAITS = [
    { id: "1", text: "Confident speaker", category: "personality", score: 0.8 },
    { id: "2", text: "Lives in New York", category: "location", score: 0.9 },
    { id: "3", text: "Improve networking", category: "goal", score: 0.7 },
    { id: "4", text: "Close with sister", category: "relationship", score: 0.6 },
    { id: "5", text: "Introverted", category: "personality", score: 0.5 },
];

const MOCK_MEMORIES = [
    { id: "m1", text: "Discussed career change", created_at: Date.now() / 1000 - 86400 },
    { id: "m2", text: "Talked about public speaking", created_at: Date.now() / 1000 - 172800 },
    { id: "m3", text: "Reflected on childhood", created_at: Date.now() / 1000 - 86400 * 60 },
];

describe("TraitConnectionGraph", () => {
    it("renders empty state when no traits", () => {
        render(<TraitConnectionGraph traits={[]} />);
        expect(screen.getByText(/No traits yet/)).toBeTruthy();
    });

    it("renders SVG with trait nodes when traits provided", () => {
        const { container } = render(<TraitConnectionGraph traits={MOCK_TRAITS} />);
        const svg = container.querySelector("svg");
        expect(svg).toBeTruthy();
        // Should have a center "You" node
        expect(screen.getByText("You")).toBeTruthy();
    });

    it("renders legend items for categories", () => {
        const { container } = render(<TraitConnectionGraph traits={MOCK_TRAITS} />);
        // 4 legend entries (Personality, Location, Goals, Relationships)
        const legendTexts = container.querySelectorAll("svg text");
        const legendLabels = Array.from(legendTexts).map((t) => t.textContent);
        expect(legendLabels).toContain("Personality");
        expect(legendLabels).toContain("Location");
        expect(legendLabels).toContain("Goals");
        expect(legendLabels).toContain("Relationships");
    });

    it("renders trait labels in nodes", () => {
        render(<TraitConnectionGraph traits={MOCK_TRAITS} />);
        expect(screen.getByText("Confident speaker")).toBeTruthy();
        expect(screen.getByText("Lives in New York")).toBeTruthy();
    });

    it("truncates long trait text", () => {
        const longTraits = [
            { id: "long1", text: "This is a very long trait that should be truncated", category: "personality", score: 0.5 },
        ];
        render(<TraitConnectionGraph traits={longTraits} />);
        // text.slice(0, 20) + "..." = "This is a very long ..."
        expect(screen.getByText("This is a very long ...")).toBeTruthy();
    });
});

describe("PatternInsights", () => {
    it("returns null when no traits or memories", () => {
        const { container } = render(<PatternInsights traits={[]} memories={[]} />);
        expect(container.innerHTML).toBe("");
    });

    it("renders dominant pattern insight", () => {
        render(<PatternInsights traits={MOCK_TRAITS} memories={MOCK_MEMORIES} />);
        expect(screen.getByText("Dominant Pattern")).toBeTruthy();
    });

    it("renders well-rounded profile insight for 3+ categories", () => {
        render(<PatternInsights traits={MOCK_TRAITS} memories={MOCK_MEMORIES} />);
        expect(screen.getByText("Well-Rounded Profile")).toBeTruthy();
    });

    it("renders memory activity insight", () => {
        render(<PatternInsights traits={MOCK_TRAITS} memories={MOCK_MEMORIES} />);
        expect(screen.getByText("Memory Activity")).toBeTruthy();
    });

    it("renders category distribution bar", () => {
        const { container } = render(<PatternInsights traits={MOCK_TRAITS} memories={MOCK_MEMORIES} />);
        expect(screen.getByText("Category Distribution")).toBeTruthy();
        // Should have distribution segments
        const segments = container.querySelectorAll("[title]");
        expect(segments.length).toBeGreaterThan(0);
    });

    it("renders narrow focus insight for single-category traits", () => {
        const singleCat = [
            { id: "1", text: "Trait A", category: "personality", score: 0.5 },
            { id: "2", text: "Trait B", category: "personality", score: 0.5 },
            { id: "3", text: "Trait C", category: "personality", score: 0.5 },
        ];
        render(<PatternInsights traits={singleCat} memories={[]} />);
        expect(screen.getByText("Narrow Focus")).toBeTruthy();
    });
});
