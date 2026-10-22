
import type { RequestHandler } from "express";

import { validateTicketFile } from "../validation/validateTicketFile";

export const validateUploadedTicket: RequestHandler = (
  req,
  res,
  next,
) => {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      success: false,
      message: "Debes seleccionar un ticket.",
    });
    return;
  }

  const validation = validateTicketFile(
    file.buffer,
    file.mimetype,
  );

  if (!validation.valid) {
    res.status(400).json({
      success: false,
      message: validation.reason,
    });
    return;
  }

  next();
};
