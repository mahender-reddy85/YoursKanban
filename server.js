import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// ✅ TEST ROUTE (must exist)
app.get("/", (req, res) => {
  res.status(200).json({ ok: true, message: "YoursKanban backend running" });
});

// ✅ TEST ROUTE (must exist)
app.get("/__routes", (req, res) => {
  res.status(200).json({ ok: true, message: "Routes OK" });
});

// ✅ TEMP REGISTER (must exist)
app.post("/api/auth/register", (req, res) => {
  console.log("Register request:", req.body);
  res.status(200).json({ 
    ok: true, 
    message: "Register endpoint working",
    got: req.body 
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
});
