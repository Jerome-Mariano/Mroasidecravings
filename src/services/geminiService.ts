import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, Order, AIAction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
You are an AI Cashier & Inventory Manager.
Your role is to parse user commands into structured actions for a retail system.

Current Inventory:
{inventory}

Current Order:
{currentOrder}

Rules:
1. Always return a JSON object with an 'action' field.
2. 'action' should be one of:
   - { type: 'ADD_ITEM', name: string, quantity: number, price?: number }
   - { type: 'REMOVE_ITEM', name: string }
   - { type: 'FINALIZE_ORDER' }
   - { type: 'CHECK_INVENTORY', name: string }
   - { type: 'RESTOCK', name: string, quantity: number }
   - { type: 'SHOW_SALES', range?: string }
   - { type: 'EXPORT_SALES' }
   - { type: 'EXPORT_INVENTORY' }
   - { type: 'MESSAGE', text: string }

3. If the user says "New order", clear the current order (implicit in ADD_ITEM if no order exists).
4. If the user adds an item, check if it exists in inventory. If it does, use the inventory price. If not, ask for the price or use the provided one.
5. If inventory is low, include a message in the response.
6. For "Finalize order", ensure all items are confirmed.
7. For "Export", return the appropriate EXPORT action.
8. If the command is ambiguous, return a MESSAGE action asking for clarification.

Respond ONLY with valid JSON.
`;

export async function processCommand(
  command: string,
  inventory: InventoryItem[],
  currentOrder: Order | null
): Promise<AIAction> {
  const inventoryStr = JSON.stringify(inventory, null, 2);
  const orderStr = JSON.stringify(currentOrder, null, 2);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: command,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION
        .replace("{inventory}", inventoryStr)
        .replace("{currentOrder}", orderStr),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              text: { type: Type.STRING },
              range: { type: Type.STRING },
            },
            required: ["type"],
          },
        },
        required: ["action"],
      },
    },
  });

  try {
    const result = JSON.parse(response.text);
    return result.action;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return { type: 'MESSAGE', text: "Sorry, I couldn't process that command. Please try again." };
  }
}
