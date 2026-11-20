// The kanban turn-response protocol's checkable rules. Generated from plugin/spec/kanban.yaml by plugin/tools/spec/compile.ts: edit the spec and run spec-build, never this file.

export const SPEC = {
  "lists": {
    "done": {
      "header": "Done",
      "glyph": "✅",
      "aliases": [],
      "rolls-up": false,
      "settling-words": {}
    },
    "pending": {
      "header": "Pending",
      "glyph": "🚧",
      "aliases": [
        "Unfinished",
        "Open"
      ],
      "rolls-up": true,
      "settling-words": {}
    },
    "logged": {
      "header": "Logged",
      "glyph": "📝",
      "aliases": [],
      "rolls-up": false,
      "settling-words": {}
    },
    "waiting": {
      "header": "Waiting",
      "glyph": "⏳",
      "aliases": [],
      "rolls-up": true,
      "settling-words": {}
    },
    "answers": {
      "header": "Answers",
      "glyph": "❓",
      "aliases": [
        "Questions"
      ],
      "rolls-up": false,
      "settling-words": {}
    },
    "authorizations": {
      "header": "Authorizations",
      "glyph": "🔑",
      "aliases": [],
      "rolls-up": true,
      "settling-words": {}
    },
    "review": {
      "header": "Review",
      "glyph": "🔍",
      "aliases": [
        "To review"
      ],
      "rolls-up": true,
      "settling-words": {}
    },
    "todo": {
      "header": "Todo",
      "glyph": "👉",
      "aliases": [
        "To do"
      ],
      "rolls-up": true,
      "settling-words": {}
    },
    "decide": {
      "header": "Decide",
      "glyph": "🧠",
      "aliases": [
        "Decisions",
        "Blocked"
      ],
      "rolls-up": true,
      "settling-words": {}
    }
  },
  "options": {
    "pro": "➕",
    "con": "➖",
    "kinds": {
      "radio": {
        "picks": "one",
        "glyph": "🔘",
        "letters": {},
        "taught": true
      },
      "checkbox": {
        "picks": "any",
        "glyph": "🔲",
        "letters": {},
        "taught": true
      },
      "binary": {
        "picks": "one",
        "glyph": "👍",
        "letters": {
          "Y": "👍",
          "N": "👎"
        },
        "taught": false
      }
    }
  },
  "commands": {
    "names": {
      "reassess": {
        "synonyms": [
          "recheck",
          "regenerate",
          "recalculate"
        ],
        "from-last-line": true
      },
      "open": {
        "synonyms": [
          "pending",
          "restate"
        ],
        "from-last-line": false
      }
    },
    "unique-prefix-runs": true,
    "trailing-punctuation": ".,;:!",
    "skill-commands": [
      "coding-agent-kanban-turn-responses",
      "reply-block"
    ]
  },
  "reference": {
    "turn-id": {
      "length": 8,
      "shortest": 6,
      "alphabet": "0123456789abcdef"
    },
    "letters": {
      "first": "A",
      "last": "Z"
    },
    "turn-after": [
      "of",
      "from"
    ]
  },
  "roll-up": {
    "glyph": "📌",
    "header": "Outstanding from previous turns",
    "aliases": [
      "Still open from earlier"
    ],
    "count-label": "Outstanding",
    "count-separator": " · "
  },
  "tag": {
    "glyph": "🔖",
    "digits": "₀₁₂₃₄₅₆₇₈₉",
    "minus": "₋"
  },
  "characters": {
    "header-underline": "▔",
    "roll-up-underline": "━",
    "topic-underline": "═",
    "separator": "⠀"
  }
} as const;

/** The spec's type: deeply readonly, each value its literal. */
export type Spec = typeof SPEC;
