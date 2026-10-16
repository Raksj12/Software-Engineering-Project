import express from "express";
import cors from "cors"; 
import dotenv from "dotenv"; 

dotenv.config();

const app = express(); 
const PORT = process.env.PORT || 3000;

app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
    }),

    
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        status: "ok", 
        message: "BookHaven API is running",

    })
})


app.listen(PORT, () => {
    console.log(`Bookhaven API is running at http://localhost:${PORT}`);
});