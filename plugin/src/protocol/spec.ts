// The kanban turn-response protocol's checkable rules. Generated from plugin/spec/kanban.yaml by plugin/tools/spec/compile.ts: edit the spec and run spec-build, never this file.

export const SPEC = {
  "lists": {
    "done": {
      "header": "Done",
      "glyph": "✅",
      "rolls-up": false,
      "settled-by": "none",
      "settling-words": {},
      "feedback": "none"
    },
    "pending": {
      "header": "Pending",
      "glyph": "🚧",
      "rolls-up": true,
      "settled-by": "none",
      "settling-words": {},
      "feedback": "none"
    },
    "logged": {
      "header": "Logged",
      "glyph": "📝",
      "rolls-up": false,
      "settled-by": "none",
      "settling-words": {},
      "feedback": "none"
    },
    "waiting": {
      "header": "Waiting",
      "glyph": "⏳",
      "rolls-up": true,
      "settled-by": "report",
      "settling-words": {},
      "feedback": "none"
    },
    "answers": {
      "header": "Answers",
      "glyph": "❓",
      "rolls-up": false,
      "settled-by": "none",
      "settling-words": {},
      "feedback": "none"
    },
    "authorizations": {
      "header": "Authorizations",
      "glyph": "🔑",
      "rolls-up": true,
      "settled-by": "none",
      "settling-words": {},
      "feedback": "none"
    },
    "review": {
      "header": "Review",
      "glyph": "🔍",
      "rolls-up": true,
      "settled-by": "merged-pull-request",
      "settling-words": {},
      "feedback": "none"
    },
    "todo": {
      "header": "Todo",
      "glyph": "👉",
      "rolls-up": true,
      "settled-by": "settling-word",
      "settling-words": {
        "done": "settles it, the person having done it",
        "skip": "settles it, the person not doing it"
      },
      "feedback": "settling-words"
    },
    "decide": {
      "header": "Decide",
      "glyph": "🧠",
      "rolls-up": true,
      "settled-by": "answer",
      "settling-words": {},
      "feedback": "options"
    }
  },
  "options": {
    "pro": "➕",
    "con": "➖",
    "kinds": {
      "radio": {
        "picks": "one",
        "glyph": "🔘"
      },
      "checkbox": {
        "picks": "any",
        "glyph": "🔲"
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
    ],
    "separators": [
      ",",
      ";",
      "/"
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
