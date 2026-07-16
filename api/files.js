const {
  put,
  del
} = require("@vercel/blob");

const formidable =
  require("formidable");

const fs =
  require("node:fs/promises");

const {
  getDb,
  toObjectId,
  serialize
} = require("../lib/db");

const {
  getSession
} = require("../lib/auth");

const {
  action,
  allowMethods,
  cleanText,
  readJson
} = require("../lib/http");

module.exports.config = {
  api: {
    bodyParser: false
  }
};

function parseForm(
  req,
  maxFileSize
) {
  return new Promise(
    function(resolve, reject) {
      const form = formidable({
        maxFileSize,
        multiples: false
      });

      form.parse(
        req,
        function(error, fields, files) {
          if (error) {
            reject(error);
            return;
          }

          resolve({
            fields,
            files
          });
        }
      );
    }
  );
}

function first(value) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function isPlayer(session) {
  return (
    normalizeRole(session?.role) ===
    "player"
  );
}

function isStaff(session) {
  return [
    "admin",
    "coach",
    "advisor"
  ].includes(
    normalizeRole(session?.role)
  );
}

function serializeFile(file) {
  const serialized =
    serialize(file);

  return {
    ...serialized,

    id: String(
      serialized.id ||
      serialized._id ||
      ""
    ),

    _id: String(
      serialized._id ||
      serialized.id ||
      ""
    ),

    playerId:
      serialized.playerId
        ? String(
            serialized.playerId
          )
        : ""
  };
}

async function avatarRoute(
  req,
  res,
  db,
  session
) {
  if (
    !allowMethods(
      req,
      res,
      [
        "POST",
        "DELETE"
      ]
    )
  ) {
    return;
  }

  if (
    !isPlayer(session) ||
    !session.userId
  ) {
    return res.status(403).json({
      error:
        "Player access is required."
    });
  }

  const playerId =
    toObjectId(session.userId);

  if (!playerId) {
    return res.status(401).json({
      error:
        "The session contains an invalid player ID."
    });
  }

  const users =
    db.collection("users");

  const player =
    await users.findOne({
      _id: playerId,
      type: {
        $regex: /^player$/i
      }
    });

  if (!player) {
    return res.status(404).json({
      error:
        "Player account not found."
    });
  }

  if (req.method === "DELETE") {
    if (player.avatarPathname) {
      await del(
        player.avatarPathname
      ).catch(function(error) {
        console.error(
          "Old avatar deletion error:",
          error
        );
      });
    }

    await users.updateOne(
      {
        _id: playerId
      },
      {
        $unset: {
          avatarUrl: "",
          avatarPathname: ""
        },

        $set: {
          updatedAt: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      avatarUrl: ""
    });
  }

  const parsed =
    await parseForm(
      req,
      8 * 1024 * 1024
    );

  const file =
    first(parsed.files.file);

  if (!file) {
    return res.status(400).json({
      error:
        "An image file is required."
    });
  }

  const mimeType =
    String(
      file.mimetype || ""
    );

  if (
    !mimeType.startsWith(
      "image/"
    )
  ) {
    return res.status(400).json({
      error:
        "The selected file must be an image."
    });
  }

  const buffer =
    await fs.readFile(
      file.filepath
    );

  const originalName =
    String(
      file.originalFilename ||
      "avatar"
    );

  const safeName =
    originalName.replace(
      /[^a-zA-Z0-9._-]/g,
      "-"
    );

  const blob =
    await put(
      `players/${playerId}/avatar-${Date.now()}-${safeName}`,
      buffer,
      {
        access: "public",

        contentType:
          mimeType ||
          "application/octet-stream",

        addRandomSuffix: true
      }
    );

  if (player.avatarPathname) {
    await del(
      player.avatarPathname
    ).catch(function(error) {
      console.error(
        "Old avatar deletion error:",
        error
      );
    });
  }

  await users.updateOne(
    {
      _id: playerId
    },
    {
      $set: {
        avatarUrl: blob.url,
        avatarPathname:
          blob.pathname,
        updatedAt: new Date()
      }
    }
  );

  return res.status(201).json({
    success: true,
    avatarUrl: blob.url,
    url: blob.url
  });
}

async function fileRoute(
  req,
  res,
  db,
  session
) {
  if (
    !allowMethods(
      req,
      res,
      [
        "GET",
        "POST",
        "DELETE"
      ]
    )
  ) {
    return;
  }

  const playerSession =
    isPlayer(session);

  const staffSession =
    isStaff(session);

  if (
    !playerSession &&
    !staffSession
  ) {
    return res.status(403).json({
      error: "Forbidden."
    });
  }

  let ownPlayerId = null;

  if (playerSession) {
    ownPlayerId =
      toObjectId(
        session.userId
      );

    if (!ownPlayerId) {
      return res.status(401).json({
        error:
          "The session contains an invalid player ID."
      });
    }
  }

  const collection =
    db.collection(
      "playerFiles"
    );

  if (req.method === "GET") {
    const query =
      playerSession
        ? {
            playerId:
              ownPlayerId
          }
        : {};

    const records =
      await collection
        .find(query)
        .sort({
          createdAt: -1
        })
        .toArray();

    return res.status(200).json({
      files:
        records.map(
          serializeFile
        )
    });
  }

  if (req.method === "POST") {
    const parsed =
      await parseForm(
        req,
        100 * 1024 * 1024
      );

    const fields =
      parsed.fields;

    const uploaded =
      first(
        parsed.files.file
      );

    if (!uploaded) {
      return res.status(400).json({
        error:
          "A file is required."
      });
    }

    let playerId =
      ownPlayerId;

    if (!playerSession) {
      playerId =
        toObjectId(
          first(
            fields.playerId
          ) ||
          first(
            fields.userId
          )
        );
    }

    if (!playerId) {
      return res.status(400).json({
        error:
          "A valid player ID is required."
      });
    }

    const player =
      await db
        .collection("users")
        .findOne({
          _id: playerId,
          type: {
            $regex: /^player$/i
          }
        });

    if (!player) {
      return res.status(404).json({
        error:
          "Player account not found."
      });
    }

    const buffer =
      await fs.readFile(
        uploaded.filepath
      );

    const name =
      String(
        uploaded.originalFilename ||
        "file"
      );

    const safeName =
      name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );

    const mimeType =
      uploaded.mimetype ||
      "application/octet-stream";

    const blob =
      await put(
        `players/${playerId}/files/${Date.now()}-${safeName}`,
        buffer,
        {
          access: "public",
          contentType: mimeType,
          addRandomSuffix: true
        }
      );

    const document = {
      playerId,

      uploadedById:
        session.userId
          ? toObjectId(
              session.userId
            )
          : null,

      uploadedByRole:
        session.role || "",

      name,
      fileName: name,

      category:
        cleanText(
          first(
            fields.category
          ),
          80
        ) || "Other",

      note:
        cleanText(
          first(
            fields.note
          ),
          1000
        ),

      mimeType,

      size:
        Number(
          uploaded.size ||
          buffer.length
        ),

      url: blob.url,
      fileUrl: blob.url,
      pathname:
        blob.pathname,

      createdAt:
        new Date()
    };

    const result =
      await collection.insertOne(
        document
      );

    return res.status(201).json({
      success: true,

      file:
        serializeFile({
          ...document,
          _id:
            result.insertedId
        })
    });
  }

  const body =
    await readJson(req);

  const id =
    toObjectId(body.id);

  if (!id) {
    return res.status(400).json({
      error:
        "A valid file ID is required."
    });
  }

  const query =
    playerSession
      ? {
          _id: id,
          playerId:
            ownPlayerId
        }
      : {
          _id: id
        };

  const file =
    await collection.findOne(
      query
    );

  if (!file) {
    return res.status(404).json({
      error:
        "File not found or you do not have permission to delete it."
    });
  }

  if (file.pathname) {
    await del(
      file.pathname
    ).catch(function(error) {
      console.error(
        "Blob deletion error:",
        error
      );
    });
  }

  await collection.deleteOne(
    query
  );

  return res.status(200).json({
    success: true
  });
}

module.exports =
  async function handler(
    req,
    res
  ) {
    try {
      const session =
        await getSession(req);

      if (!session) {
        return res.status(401).json({
          error:
            "No active session."
        });
      }

      const role =
        normalizeRole(
          session.role
        );

      if (
        ![
          "player",
          "admin",
          "coach",
          "advisor"
        ].includes(role)
      ) {
        return res.status(403).json({
          error: "Forbidden."
        });
      }

      const db =
        await getDb();

      const route =
        action(req) ||
        "files";

      if (route === "avatar") {
        return avatarRoute(
          req,
          res,
          db,
          session
        );
      }

      if (route === "files") {
        return fileRoute(
          req,
          res,
          db,
          session
        );
      }

      return res.status(404).json({
        error:
          "File action not found."
      });
    } catch (error) {
      console.error(
        "Files API error:",
        error
      );

      return res.status(500).json({
        error:
          "File request failed.",

        details:
          error.message
      });
    }
  };