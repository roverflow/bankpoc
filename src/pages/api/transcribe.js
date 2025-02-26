import formidable, { errors as formidableErrors } from "formidable";
import fetch from "node-fetch";
import fs from "fs";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const whichAI = process.env.WHICH_AI || "google";

export const config = {
  api: {
    bodyParser: false,
  },
};

const mimeTypes = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  // Add more MIME types as needed
};

function determineMimeType(filePath) {
  const fileExtension = filePath.split(".").pop().toLowerCase();
  return mimeTypes[fileExtension] || "audio/wav"; // Default to 'audio/wav' if unknown
}

function fileToBlob(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        return reject(err);
      }
      const mimeType = determineMimeType(filePath);
      const blob = new Blob([data], { type: mimeType });
      resolve(blob);
    });
  });
}

async function parseForm(req) {
  const form = formidable({});
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}

async function sendToOpenAI(fileStream, filename) {
  const formData = new FormData();
  formData.append("file", fileStream, filename);
  formData.append("model", "whisper-1");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Error fetching data: ${response.statusText}`);
  }

  return response.json();
}

async function sendToGoogleAI(filePath, mimeType) {
  const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: "Audio sample",
  });

  let file = await fileManager.getFile(uploadResult.file.name);
  while (file.state === FileState.PROCESSING) {
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 10_000)); // Sleep for 10 seconds
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error("Audio processing failed.");
  }

  console.log(
    `Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`
  );

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([
    "Transcribe this audio clip. Do not give me anything else, just the transcription. even if the audio is not clear.",
    {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      },
    },
  ]);

  return {
    text: result.response.text(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Only POST requests are accepted." });
  }

  try {
    const { fields, files } = await parseForm(req);

    const audioBlob = files.audioblob;
    const ai = fields.ai;

    if (!audioBlob) {
      return res
        .status(400)
        .json({ error: "Missing audioBlob in the request." });
    }

    if (!ai) {
      return res
        .status(400)
        .json({ error: "Missing ai parameter in the request." });
    }

    const fileStream = await fileToBlob(audioBlob[0].filepath);
    let responseData;

    if (whichAI === "openai") {
      responseData = await sendToOpenAI(
        fileStream,
        audioBlob[0].originalFilename
      );
    } else {
      responseData = await sendToGoogleAI(
        audioBlob[0].filepath,
        audioBlob[0].mimetype
      );
    }

    res.status(200).json(responseData);
  } catch (err) {
    if (err.code === formidableErrors.maxFieldsExceeded) {
      console.error("Too many fields in the form:", err);
    } else {
      console.error("Error processing request:", err);
    }
    res.status(500).json({ text: "Internal Server Error" });
  }
}
