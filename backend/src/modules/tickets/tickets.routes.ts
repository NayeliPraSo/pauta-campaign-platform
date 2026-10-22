
import { Router } from "express";

import { uploadTicket } from "./middlewares/uploadTicket.middleware.js";
import { validateUploadedTicket } from "./middlewares/validateUploadedTicket.middleware.js";

export const ticketsRouter = Router();

ticketsRouter.post(
  "/",
  uploadTicket.single("file"),
  validateUploadedTicket,
  (req, res) => {
    const file = req.file!;

    res.status(200).json({
      success: true,
      message: "El archivo superó las validaciones iniciales.",
      data: {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  },
);
