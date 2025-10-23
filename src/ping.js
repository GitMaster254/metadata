/**
*Ping route for uptime
*/

import express from "express";

const router = express.Router();

router.get("/",(req,res)=>{
    res.status(200).json({
    status:"ok",
    message:"server is alive",
    timestamp:new Date().toISOString(),
    });
});

export default router;