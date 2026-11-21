// The kanban turn-response protocol's checkable rules. Generated from plugin/spec/kanban.yaml by plugin/tools/spec/compile.ts: edit the spec and run spec-build, never this file.

export const SPEC = {
  "lists": {
    "done": {
      "header": "Done",
      "glyph": "✅",
      "aliases": [],
      "rolls-up": false,
      "settled-by": "none",
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
      "settled-by": "none",
      "settling-words": {}
    },
    "logged": {
      "header": "Logged",
      "glyph": "📝",
      "aliases": [],
      "rolls-up": false,
      "settled-by": "none",
      "settling-words": {}
    },
    "waiting": {
      "header": "Waiting",
      "glyph": "⏳",
      "aliases": [],
      "rolls-up": true,
      "settled-by": "report",
      "settling-words": {}
    },
    "answers": {
      "header": "Answers",
      "glyph": "❓",
      "aliases": [
        "Questions"
      ],
      "rolls-up": false,
      "settled-by": "none",
      "settling-words": {}
    },
    "authorizations": {
      "header": "Authorizations",
      "glyph": "🔑",
      "aliases": [],
      "rolls-up": true,
      "settled-by": "none",
      "settling-words": {}
    },
    "review": {
      "header": "Review",
      "glyph": "🔍",
      "aliases": [
        "To review"
      ],
      "rolls-up": true,
      "settled-by": "merged-pull-request",
      "settling-words": {}
    },
    "todo": {
      "header": "Todo",
      "glyph": "👉",
      "aliases": [
        "To do"
      ],
      "rolls-up": true,
      "settled-by": "none",
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
      "settled-by": "answer",
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
  "skill": {
    "name": "coding-agent-kanban-turn-responses"
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
  "frees": {
    "label": "Frees",
    "separator": ","
  },
  "subject": {
    "alphabet": "0123456789abcdefghijklmnopqrstuvwxyz",
    "words-kept": 3,
    "stop-words": [
      "a",
      "an",
      "and",
      "at",
      "by",
      "for",
      "from",
      "in",
      "is",
      "its",
      "of",
      "on",
      "the",
      "to",
      "with"
    ],
    "entry": {
      "label": "entry",
      "words": [
        "entry",
        "entries"
      ],
      "digits": {
        "fewest": 3,
        "most": 4
      }
    },
    "branch": {
      "label": "branch",
      "separator": "-",
      "fewest-words": 2
    }
  },
  "roll-up": {
    "glyph": "📌",
    "header": "Outstanding from previous turns",
    "aliases": [
      "Still open from earlier"
    ],
    "count-label": "Outstanding",
    "count-separator": " · ",
    "interval": {
      "most-minutes": 30,
      "times": 5,
      "turns": 5
    }
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
