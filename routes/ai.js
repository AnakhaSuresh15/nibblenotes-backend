const GoogleGenAI = require("@google/genai").GoogleGenAI;
const express = require("express");
const router = express.Router();

const ai = new GoogleGenAI({});

router.post("/generate-recipe", async (req, res) => {
  const { mealName } = req.body;

  if (!mealName) {
    return res.status(400).json({ error: "Meal name required" });
  }

  try {
    const prompt = `
Generate a recipe for: ${mealName}

Return ONLY valid JSON in this exact format:
{
  "ingredients": "string",
  "preparation": "string",
  "calories": number
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    const text = response.text;

    const parsed = JSON.parse(text);

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

module.exports = router;
