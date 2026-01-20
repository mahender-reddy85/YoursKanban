module.exports = async (req, res) => {
  try {
    const db = req.db; // ✅ THIS IS YOUR POOL

    const { name, email, password } = req.body;

    const existing = await db.query(
      "SELECT 1 FROM users WHERE email = $1",
      [email]
    );

    return res.status(200).json({ ok: true, existing: existing.rows.length });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Server error during registration" });
  }
};
