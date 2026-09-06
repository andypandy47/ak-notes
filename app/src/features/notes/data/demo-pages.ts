import type { Page } from "../types";

export const demoPages: Page[] = [
  {
    id: "welcome",
    title: "A little room for your thoughts",
    updated: "2026-09-06T09:00:00Z",
    blocks: [
      {
        type: "paragraph",
        content:
          "Somewhere to think out loud. Collect the small things, untangle the big things, and make a little space for whatever comes next.",
      },
      {
        type: "heading",
        props: { level: 2 },
        content: "Make yourself at home",
      },
      {
        type: "paragraph",
        content:
          "Every page is a fresh start. Write naturally, or type / to add a heading, a list, a quote, and more. Select some text to make it your own.",
      },
      {
        type: "bulletListItem",
        content: "Capture an idea before it disappears.",
      },
      {
        type: "bulletListItem",
        content: "Keep the details of a project in one place.",
      },
      {
        type: "bulletListItem",
        content: "Drag the handle beside a block to rearrange your thoughts.",
      },
      { type: "heading", props: { level: 2 }, content: "A few things to try" },
      {
        type: "checkListItem",
        props: { checked: true },
        content: "Find a quiet place to write",
      },
      {
        type: "checkListItem",
        props: { checked: false },
        content: "Create a page for something on your mind",
      },
      {
        type: "checkListItem",
        props: { checked: false },
        content: "Move a block and see where it fits",
      },
      { type: "paragraph", content: "" },
    ],
  },
  {
    id: "week",
    title: "This week, a little less",
    updated: "2026-09-05T16:20:00Z",
    blocks: [
      {
        type: "paragraph",
        content: "A short list of things worth making time for.",
      },
      { type: "heading", props: { level: 2 }, content: "The essentials" },
      { type: "checkListItem", content: "Take a long walk without headphones" },
      {
        type: "checkListItem",
        content: "Finish one thing before starting another",
      },
      { type: "checkListItem", content: "Leave an evening unplanned" },
    ],
  },
  {
    id: "ideas",
    title: "Things I want to make",
    updated: "2026-09-04T11:30:00Z",
    blocks: [
      {
        type: "paragraph",
        content: "An imperfect collection of possibilities. No deadlines required.",
      },
      {
        type: "bulletListItem",
        content: "A personal notebook that feels like home",
      },
      {
        type: "bulletListItem",
        content: "A small collection of favourite recipes",
      },
      { type: "bulletListItem", content: "A photo journal of ordinary days" },
    ],
  },
  {
    id: "reading",
    title: "Notes from the margins",
    updated: "2026-09-02T18:00:00Z",
    blocks: [
      {
        type: "paragraph",
        content: "For the sentences that stay with you after you close the book.",
      },
      { type: "heading", props: { level: 2 }, content: "On my reading list" },
      {
        type: "paragraph",
        content: "Start with a title, a thought, or a question.",
      },
    ],
  },
];
