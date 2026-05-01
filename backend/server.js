require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const mongoose = require("mongoose");
const app = express();
// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected!"))
  .catch(err => console.error("MongoDB error:", err));

// Task Schema
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, default: "task" },
  priority: { type: String, default: "medium" },
  deadline: { type: String, default: null },
  steps: { type: [String], default: [] },   // ✅ NEW
  intent: { type: String, default: "" },    // ✅ NEW 
  category: { type: String, default: "General" },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model("Task", taskSchema);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

app.get("/", (req, res) => {
  res.json({ message: "ScreenTask AI backend is running!" });
});

app.post("/process-screenshot", async (req, res) => {
  const { imageData } = req.body;

  if (!imageData) {
    return res.status(400).json({ error: "No image received" });
  }

  const prompt = `
You are an AI system that converts screenshot content into structured, actionable workflows.

IMPORTANT RULES:
- Do NOT give generic intent like "respond to messages"
- Intent must clearly describe the final goal the user needs to achieve
- Focus on actionable outcomes (e.g., complete assignments, submit feedback, pay fees)

STEP-BY-STEP:

1. Identify the MAIN GOAL (intent)
   - It must be specific and outcome-based
   - BAD: "respond to messages"
   - GOOD: "Complete pending academic tasks including assignments, feedback, and course preparation"

2. Extract ONLY meaningful tasks (ignore UI noise)

3. Break each task into clear steps

4. Assign priority based on urgency and deadlines
5. Avoid duplicate or overlapping tasks
   - Merge similar tasks into one if they represent the same goal

6. Each task must be distinct and non-redundant

7. Prioritize tasks based on deadlines and importance
   - If a deadline exists, mark as high priority
8. Explain priority based on deadline or urgency internally before assigning
9. If no meaningful tasks exist, return empty tasks array

EXAMPLE:

Input: "Assignment due tomorrow, feedback pending, course link"
Output:
{
  "intent": "Complete pending academic tasks before deadlines",
  "tasks": [
    {
      "title": "Submit assignment",
      "steps": ["Complete answers", "Upload file"],
      "priority": "high",
      "deadline": "tomorrow"
    }
  ]
}

Return ONLY valid JSON in this format:

{
  "intent": "specific goal",
  "tasks": [
    {
      "title": "task description",
      "steps": ["step 1", "step 2"],
      "priority": "high or medium or low",
      "deadline": "deadline if found, or null"
    }
  ]
}
`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 1024,
    });

    

    let text = response.choices[0].message.content;
    console.log("RAW AI OUTPUT:\n", text);
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(text);
    console.log("Tasks extracted:", parsed.tasks.length);

// MongoDB me save karo
    const savedTasks = await Promise.all(
  parsed.tasks.map(task => 
  new Task({
    ...task,
    intent: parsed.intent || ""
  }).save()
)
);

console.log("Tasks saved to DB!");
res.json({ success: true, tasks: savedTasks });

  } catch (error) {
    console.error("Groq error:", error.message);
    res.status(500).json({ error: "Failed to process image" });
  }
});
app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});
app.delete("/task/:id", async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});
app.patch("/task/:id", async (req, res) => {
  try {
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after' }
    );

    res.json({ success: true, task: updated });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});