import { Type } from "@google/genai";
import fs from "node:fs";
import { DateTime } from "luxon";

export const config = {
  port: 3000,
  chatHistoryLimit: 15,
  model: 'gemini-2.0-flash',
  // Google AI Api Keys, using avaliable one
  apiKeys: ["AIzaSyAOrNzsd7JwHLRt09PhwxkCZpj1bT1mXVM"],

  messageTemplate: "[%ROLE%] %PLAYER% (%PREFIX%): %MESSAGE%",
  
  roleMap: {
    "ǩ": "Проходка",
    "ষ": "Игрок",
    "Ǽ": "Хелпер",
    "ʬ": "Модератор",
    "Ԭ": "Ютуб",
    "Ջ": "Твич",
  },

  tools: [
    {
      functionDeclarations: [
        {
          name: 'say',
          description: "Используй чтобы задать тему сообщения для чата. В topic укажи тему сообщения, а не само сообщение. Например, 'Сообщить игроку о моих координатах: x=, y=, z=' и т.д",
          parameters: {
            type: Type.OBJECT,
            required: ["topic"],
            properties: {
              topic: {
                type: Type.STRING,
              },
            },
          },
        },
        {
          name: 'lookAt',
          description: 'Используй эту функцию чтобы сказать что-то игроку',
          parameters: {
            type: Type.OBJECT,
            required: ["x", "y", "z"],
            properties: {
              x: {
                type: Type.NUMBER,
              },
              y: {
                type: Type.NUMBER,
              },
              z: {
                type: Type.NUMBER,
              },
            },
          },
        },
        {
          name: 'goTo',
          description: 'Используй чтобы прийти на указанные координаты. Так же используй эту функцию для перещения в случайные координаты, а также для перемещения к игроку',
          parameters: {
            type: Type.OBJECT,
            required: ["x", "z"],
            properties: {
              x: {
                type: Type.INTEGER,
              },
              y: {
                type: Type.INTEGER,
              },
              z: {
                type: Type.INTEGER,
              },
            },
          },
        },
        {
          name: 'jump',
          description: 'Используй чтобы прыгнуть count раз',
          parameters: {
            type: Type.OBJECT,
            required: ["count"],
            properties: {
              count: {
                type: Type.INTEGER,
              },
            },
          },
        },
        {
          name: 'dig',
          description: 'Используй чтобы выкопать нужный блок block count раз поблизости. Названия блоков должны быть в виде майнкрафт id, например diamond_ore для руды',
          parameters: {
            type: Type.OBJECT,
            required: ["count", "block"],
            properties: {
              block: {
                type: Type.STRING,
              },
              count: {
                type: Type.INTEGER,
              },
            },
          },
        },
        {
          name: 'eat',
          description: 'Используй чтобы поесть',
        },
        {
          name: 'heal',
          description: 'Используй чтобы вылечится',
        },
        {
          name: 'stop',
          description: 'Используй чтобы остановить текущее задание',
        },
        {
          name: 'interact',
          description: 'Используй чтобы взаимодействовать с игроком, нажать на что-то, нажать пкм',
        },
        {
          name: 'trackEntity',
          description: 'Используй чтобы следить за мобом с именем name seconds секунд',
          parameters: {
            type: Type.OBJECT,
            required: ["seconds", "name"],
            properties: {
              seconds: {
                type: Type.INTEGER,
              },
              name: {
                type: Type.STRING,
              },
            },
          },
        },
        {
          name: 'follow',
          description: "Используй чтобы следовать за сущностью с именем name. Не Используй когда нужно подойти, только следовать.",
          parameters: {
            type: Type.OBJECT,
            required: ["name"],
            properties: {
              name: {
                type: Type.STRING,
              },
            },
          },
        },
      ],
    }
  ],

  // Presets for chat, for different servers. Groups define what groups and
  // in which order they appear in regex.
  // Avaliable groups - "name", "message", "prefix", "role".

  // Response template supports following placeholders:
  // %MESSAGE% - message of response.
  // %PLAYER% - name of player who send initial message.
  chatPresets: {
    default: {
      public: {
        regexp: /\<(\w+)\>\ (.+)/gm,
        groups: ["name", "message"],
      },
      private: {
        regexp: /(.+) шепчет вам: (.+)/gm,
        groups: ["name", "message"],
        responseTemplate: "msg %PLAYER% %MESSAGE%",
        isCommand: true,
        isPersonal: true
      },
    },
    bixland: {
      global: {
        regexp: /\[Крик\] (.) (\w+) (.*)▶ (.+)/gm,
        groups: ["role", "name", "prefix", "message"],
        responseTemplate: "!%MESSAGE%",
      },
      local: {
        regexp: /\[Л\] (.) (\w+) (.*)▶ (.+)/gm,
        groups: ["role", "name", "prefix", "message"],
      },
      private: {
        regexp: /\[(.) (\w+) (.*)-> я\] (.+)/gm,
        groups: ["role", "name", "prefix", "message"],
        responseTemplate: "msg %PLAYER% %MESSAGE%",
        isCommand: true,
        isPersonal: true
      }
    },
  },
};

function readFile(filepath) {
  try {
    const data = fs.readFileSync(filepath, 'utf8');
    return data;
  } catch (err) {
    console.error(err);
  }
}