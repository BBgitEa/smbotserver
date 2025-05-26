import { GoogleGenAI } from "@google/genai";
import { Server } from "socket.io";
import { config } from "./config.js";
import { DateTime } from "luxon";
import { Database } from "./db.js";

const io = new Server({
  cors: {
    origin: "*",
  },
});

const ai = new GoogleGenAI({ apiKey: config.apiKeys[0] });

let chatHistory = [];
let gameData = {};
let currentChatPreset = "default";
let playerList = [];
let contents = [];
let awaitingAction = true;

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  socket.on("update_game_data", (arg) => {
    gameData = arg;

    // Mapping playerList
    if (
      gameData.server !== undefined &&
      gameData.server.playerEntries !== undefined
    ) {
      playerList = [];
      for (const playerEntry of gameData["server"]["playerEntries"]) {
        playerList.push(playerEntry.name);
      }
    }
  });

  socket.on("new_chat_message", async (arg) => {
    //Adding to chat history
    chatHistory.push(arg);
    if (chatHistory.length > config.chatHistoryLimit) {
      chatHistory.shift();
    }

    console.log(`Message recieved: '${arg}'`);

    //Iterating over categories in chat preset
    for (const [key, value] of Object.entries(
      config.chatPresets[currentChatPreset]
    )) {
      const regexp = value.regexp;

      if (arg.match(regexp)) {
        console.log(`Message belongs to '${key}' category of preset`);

        //Extracting matches from string
        const matches = [...arg.matchAll(regexp)];
        let groupMap = {};
        for (let i = 0; i < value.groups.length; i++) {
          groupMap[value.groups[i]] = matches[0][i + 1];
        }

        if (groupMap["name"] === gameData["player"]["name"]) {
          console.log(`Skipping own message`);
          return;
        }

        let realMessage = buildMessageString(groupMap);

        if (value.isPersonal) {
          realMessage = "(Персональное сообщение тебе)" + realMessage;
        }
        console.log(realMessage);


        contents = []
        contents = [
          {
            role: 'user',
            parts: [
              {
                text: buildMessageFunctionPrompt(realMessage),
              },
            ],
          },
        ];
        // Generating response and sanitising
        let call = await generateFunctionAIResponse();
        
        while(call !== null && call !== undefined){

          //If need to say something
          if(call.name === "say"){
            let responseMessage = cleanString(call.args['topic']);

            //Constructing message with sanitising
            let response = responseMessage;
            if (value.responseTemplate !== undefined) {
              let template = `${value.responseTemplate}`;
              template = template.replaceAll("%MESSAGE%", responseMessage);
              template = template.replaceAll("%PLAYER%", groupMap["name"]);
              response = template;
              console.log(template);
            }
        
            //Sending to client
            if (value.isCommand) socket.emit("command", response);
            else socket.emit("message", response);
          }
          else {
            socket.emit("action", call); //Calling all other functions what should be executed on Minecraft side
          }

          let call_response = {
            name: call.name,
            response: { result: "Задание успешно выполнено! Продолжи." }
          }
          contents.push({ role: 'model', parts: [{ functionCall: call }] });
          contents.push({ role: 'user', parts: [{ functionResponse: call_response }] });
    
          //for(const ob of contents){
          //  console.log(ob['parts'][0]);
          //}
    
          call = await generateFunctionAIResponse();
        }
      }
    }

    console.log(`Message cannot be classified by any category. Skipping it`);
    return;
  });

  socket.on("change_chat_preset", (arg) => {
    if (config.chatPresets[arg] !== undefined) {
      currentChatPreset = arg;
      logAndNotify(`Preset ${arg} was chosen`);
    } else logAndNotify(`Preset ${arg} not presented in config file`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client ${socket.id} disconnected. Reason: ${reason}`);
  });

  //To log in console and notify client
  function logAndNotify(message) {
    socket.emit("server_message", message);
    console.log(message);
  }
});

async function generateFunctionAIResponse() {
  let model = config.model;
  let tools = config.tools;

  const response = await ai.models.generateContentStream({
    model: model,
    contents: contents,
    config: {
      tools,
      responseMimeType: 'text/plain',
      systemInstruction: [
        {
          "text": "Ты - умный Minecraft бот. Ты определяешь какие действия тебе нужно совершить, основываясь на информации о себе и мире вокруг тебя. Останавливайся когда все функции выполнены."
        }
      ]
    },
  });

  let call;
  for await (const chunk of response) {
    if (chunk.functionCalls){
      call = chunk.functionCalls[0];
      console.log(call);
    }
    else{
      console.log(chunk.text);
    }
  }
  return call;
}

function readFile(filepath) {
  try {
    const data = fs.readFileSync(filepath, "utf8");
    return data;
  } catch (err) {
    console.error(err);
  }
}

function cleanString(input) {
  return input.replace(/[\n\r\t]+/g, " ");
}

function buildMessageFunctionPrompt(message){
  return buildFunctionPrompt(`Сообщение игрока:
    ${message}
    Определи какие функции нужно выполнить основываясь на его сообщении и в конце используй say`);
}

function buildFunctionPrompt(goalString) {
  let finalPrompt =
  `Информация о сервере:\n ${ playerList.join("\n") }\n\n` +
  `Информация о твоем игровом персонаже в данный момент времени: ${ buildGameDataString() }`+
  `История чата: ${ chatHistory.join("\n")}` +
  `Текущее время по МСК: ${ getCurrentTime() }\n` +
  goalString;

return finalPrompt;
}

function buildGameDataString() {
  let player = gameData["player"];
  let str = `
  Координаты: x=${player["position"]["x"]} y=${player["position"]["y"]} z=${player["position"]["z"]}
  Взгляд: pitch=${player["pitch"]} yaw=${player["yaw"]}
  Уровень здоровья: ${player["health"]}/${player["maxHealth"]}
  Уровень голода: ${player["hunger"]} (Насыщенность: ${player["saturation"]})
  Количество опыта: ${player["experienceProgress"]}
  Уровень опыта: ${player["experienceLevel"]}
  Измерение: ${player["dimension"]} (Переведи на русский)
  Биом: ${player["biome"]} (Переведи на русский)
  Время дня (В игре, в тиках): ${player["timeOfDay"]}
  Ближайшие сущности: \n${buildNearestEntitiesString()}
  `;
  return str;
}

function buildNearestEntitiesString() {
  let entities = gameData["player"]["nearestEntities"];
  let str = "";
  for(const entity of entities){
    str +=`Имя: ${entity["name"]},
    Координаты: x=${entity["position"]["x"]} y=${entity["position"]["y"]} z=${entity["position"]["z"]}\n`;
  }
  return str;
}

function buildPlayerDataString(playerData) {
  let str = `
  Данные об игроке ${playerData.name}:
  Уровень отношений: ${config.relationshipMap(playerData.relationshipLevel)}
  Твои воспоминания об игроке:
  ${playerData.memories}\n`;
  return str;
}

function buildMessageString(data) {
  let template = `${config.messageTemplate}`;
  template = template.replaceAll("%MESSAGE%", data["message"]);
  template = template.replaceAll("%PLAYER%", data["name"]);
  template = template.replaceAll("%ROLE%", getRoleString(data["role"]));
  template = template.replaceAll("%PREFIX%", data["prefix"]);
  return template;
}

function getRoleString(key) {
  return config.roleMap[key] === undefined ? "Неизвестно" : config.roleMap[key];
}

function getCurrentTime(){
  return DateTime.now().setZone('Europe/Moscow').toFormat('yyyy-MM-dd HH:mm:ss');
}

io.listen(config.port);
