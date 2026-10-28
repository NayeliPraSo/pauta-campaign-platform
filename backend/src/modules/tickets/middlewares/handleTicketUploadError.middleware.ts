
import type {
  ErrorRequestHandler,
} from "express";

import multer from "multer";

export const handleTicketUploadError: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message: "El archivo no puede superar los 10 MB.",
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: "No fue posible cargar el archivo.",
    });
    return;
  }

  if (
    error instanceof Error &&
    error.message ===
      "Formato no permitido. Solo se aceptan archivos PDF, JPG y PNG."
  ) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
    return;
  }

  next(error);
};
