const {
  getDb,
  toObjectId,
  serialize
} = require("../lib/db");

const {
  requirePlayer
} = require("../lib/auth");

const {
  action,
  allowMethods,
  cleanText
} = require("../lib/http");

function formatPlayer(player) {
  return {
    id: String(player._id),

    _id: String(player._id),

    firstName:
      player.firstName || "",

    lastName:
      player.lastName || "",

    email:
      player.email || "",

    phone:
      player.phone || "",

    birthYear:
      player.birthYear || "",

    position:
      player.position || "",

    currentTeam:
      player.currentTeam ||
      player.team ||
      "",

    shoots:
      player.shoots ||
      player.shot ||
      "",

    height:
      player.height || "",

    weight:
      player.weight || "",

    careerStatus:
      player.careerStatus ||
      "Youth",

    bio:
      player.bio || "",

    eliteProspects:
      player.eliteProspects || "",

    epData:
      player.epData || null,

    epSync:
      player.epSync
        ? {
            status: player.epSync.status || "never",
            lastAttemptedAt: player.epSync.lastAttemptedAt || null,
            lastSuccessfulAt: player.epSync.lastSuccessfulAt || null,
            errorCode: player.epSync.errorCode || null
          }
        : null,

    avatarUrl:
      player.avatarUrl || "",

    type:
      player.type || "Player",

    accountStatus:
      player.accountStatus || "",

    username:
      player.username || ""
  };
}

async function meRoute(
  req,
  res,
  db,
  playerId
) {
  if (
    !allowMethods(
      req,
      res,
      [
        "GET",
        "PATCH"
      ]
    )
  ) {
    return;
  }

  const users =
    db.collection("users");

  if (req.method === "GET") {
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

    return res.status(200).json({
      player:
        formatPlayer(player)
    });
  }

  const body =
    req.body || {};

  const updates = {};

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "firstName"
    )
  ) {
    updates.firstName =
      cleanText(
        body.firstName,
        100
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "lastName"
    )
  ) {
    updates.lastName =
      cleanText(
        body.lastName,
        100
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "birthYear"
    )
  ) {
    updates.birthYear =
      cleanText(
        body.birthYear,
        10
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "position"
    )
  ) {
    updates.position =
      cleanText(
        body.position,
        50
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "currentTeam"
    )
  ) {
    updates.currentTeam =
      cleanText(
        body.currentTeam,
        150
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "shoots"
    )
  ) {
    updates.shoots =
      cleanText(
        body.shoots,
        30
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "height"
    )
  ) {
    updates.height =
      cleanText(
        body.height,
        30
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "weight"
    )
  ) {
    updates.weight =
      cleanText(
        body.weight,
        30
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "email"
    )
  ) {
    updates.email =
      cleanText(
        body.email,
        200
      ).toLowerCase();
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "phone"
    )
  ) {
    updates.phone =
      cleanText(
        body.phone,
        50
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "careerStatus"
    )
  ) {
    const careerStatus =
      cleanText(
        body.careerStatus,
        30
      );

    const allowedStatuses = [
      "Youth",
      "Prep",
      "Juniors",
      "College",
      "Pro"
    ];

    if (
      !allowedStatuses.includes(
        careerStatus
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid career status."
      });
    }

    updates.careerStatus =
      careerStatus;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "bio"
    )
  ) {
    updates.bio =
      cleanText(
        body.bio,
        1500
      );
  }

  updates.updatedAt =
    new Date();

  const result =
    await users.findOneAndUpdate(
      {
        _id: playerId,
        type: {
          $regex: /^player$/i
        }
      },
      {
        $set: updates
      },
      {
        returnDocument: "after"
      }
    );

  const updatedPlayer =
    result?.value ||
    result;

  if (!updatedPlayer) {
    return res.status(404).json({
      error:
        "Player account not found."
    });
  }

  return res.status(200).json({
    message:
      "Player profile updated.",

    player:
      formatPlayer(
        updatedPlayer
      )
  });
}

async function contactsRoute(
  req,
  res,
  db
) {
  if (
    !allowMethods(
      req,
      res,
      ["GET"]
    )
  ) {
    return;
  }

  const records =
    await db
      .collection("users")
      .find({
        type: {
          $in: [
            "Admin",
            "Coach",
            "Advisor",
            "admin",
            "coach",
            "advisor"
          ]
        },

        accountStatus: {
          $in: [
            "Active",
            "active"
          ]
        }
      })
      .project({
        firstName: 1,
        lastName: 1,
        type: 1,
        role: 1,
        email: 1
      })
      .sort({
        type: 1,
        firstName: 1
      })
      .toArray();

  const contacts =
    records.map(function(item) {
      return {
        ...serialize(item),

        name:
          `${item.firstName || ""} ${item.lastName || ""}`
            .trim(),

        role:
          item.role ||
          item.type
      };
    });

  contacts.unshift({
    id: "admin",
    _id: "admin",
    name: "Collective Admin",
    role: "Admin"
  });

  return res.status(200).json({
    contacts
  });
}

async function messagesRoute(
  req,
  res,
  db,
  playerId
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

  const messages =
    db.collection("messages");

  const users =
    db.collection("users");

  if (req.method === "GET") {
    const records =
      await messages
        .find({
          $and: [
            {
              $or: [
                {
                  senderId:
                    playerId
                },
                {
                  recipientId:
                    playerId
                },
                {
                  userId:
                    playerId
                }
              ]
            },
            {
              deletedFor: {
                $ne:
                  String(playerId)
              }
            }
          ]
        })
        .sort({
          createdAt: -1
        })
        .toArray();

    const formattedMessages =
      records.map(function(record) {
        const senderIsPlayer =
          String(
            record.senderId || ""
          ) ===
          String(playerId);

        return {
          ...serialize(record),

          direction:
            senderIsPlayer
              ? "sent"
              : "received"
        };
      });

    return res.status(200).json({
      messages:
        formattedMessages
    });
  }

  if (req.method === "POST") {
    const rawRecipientId =
      String(
        req.body?.recipientId ||
        ""
      );

    const sendingToAdmin =
      rawRecipientId
        .toLowerCase() ===
      "admin";

    const recipientId =
      sendingToAdmin
        ? null
        : toObjectId(
            rawRecipientId
          );

    const subject =
      cleanText(
        req.body?.subject,
        150
      );

    const text =
      cleanText(
        req.body?.text,
        4000
      );

    if (
      (
        !recipientId &&
        !sendingToAdmin
      ) ||
      !text
    ) {
      return res.status(400).json({
        error:
          "Recipient and message are required."
      });
    }

    const sender =
      await users.findOne({
        _id: playerId
      });

    if (!sender) {
      return res.status(404).json({
        error:
          "Player account not found."
      });
    }

    const recipient =
      recipientId
        ? await users.findOne({
            _id: recipientId
          })
        : null;

    if (
      recipientId &&
      !recipient
    ) {
      return res.status(404).json({
        error:
          "Recipient not found."
      });
    }

    const senderName =
      `${sender.firstName || ""} ${sender.lastName || ""}`
        .trim() ||
      "Player";

    const recipientName =
      sendingToAdmin
        ? "Collective Admin"
        : `${recipient?.firstName || ""} ${recipient?.lastName || ""}`
            .trim() ||
          "Collective Staff";

    const document = {
      userId:
        playerId,

      senderId:
        playerId,

      recipientId:
        recipientId || null,

      recipientRole:
        sendingToAdmin
          ? "Admin"
          : recipient?.type ||
            "Staff",

      senderName,

      fromName:
        senderName,

      toName:
        recipientName,

      to:
        recipientName,

      type:
        "Player Message",

      subject,

      text,

      read:
        false,

      deletedFor:
        [],

      createdAt:
        new Date()
    };

    const result =
      await messages.insertOne(
        document
      );

    return res.status(201).json({
      message: {
        ...serialize({
          ...document,
          _id:
            result.insertedId
        }),

        direction:
          "sent"
      }
    });
  }

  const id =
    toObjectId(
      req.body?.id
    );

  if (!id) {
    return res.status(400).json({
      error:
        "Valid message ID is required."
    });
  }

  const result =
    await messages.updateOne(
      {
        _id: id,

        $or: [
          {
            senderId:
              playerId
          },
          {
            recipientId:
              playerId
          },
          {
            userId:
              playerId
          }
        ]
      },
      {
        $addToSet: {
          deletedFor:
            String(playerId)
        }
      }
    );

  if (!result.matchedCount) {
    return res.status(404).json({
      error:
        "Message not found."
    });
  }

  return res.status(200).json({
    success: true
  });
}

async function programsRoute(
  req,
  res,
  db,
  playerId
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

  const collection =
    db.collection(
      "playerPrograms"
    );

  if (req.method === "GET") {
    const records =
      await collection
        .find({
          playerId
        })
        .sort({
          createdAt: -1
        })
        .toArray();

    return res.status(200).json({
      interestedInPlayer:
        records
          .filter(function(item) {
            return (
              item.type ===
              "interestedInPlayer"
            );
          })
          .map(serialize),

      playerInterested:
        records
          .filter(function(item) {
            return (
              item.type ===
              "playerInterested"
            );
          })
          .map(serialize)
    });
  }

  if (req.method === "POST") {
    const type =
      String(
        req.body?.type || ""
      );

    const name =
      cleanText(
        req.body?.name,
        120
      );

    const allowedTypes = [
      "interestedInPlayer",
      "playerInterested"
    ];

    if (
      !allowedTypes.includes(type) ||
      !name
    ) {
      return res.status(400).json({
        error:
          "Program type and name are required."
      });
    }

    const document = {
      playerId,

      type,

      name,

      level:
        cleanText(
          req.body?.level,
          40
        ),

      contact:
        cleanText(
          req.body?.contact,
          300
        ),

      createdAt:
        new Date(),

      updatedAt:
        new Date()
    };

    const result =
      await collection.insertOne(
        document
      );

    return res.status(201).json({
      program:
        serialize({
          ...document,
          _id:
            result.insertedId
        })
    });
  }

  const id =
    toObjectId(
      req.body?.id
    );

  if (!id) {
    return res.status(400).json({
      error:
        "Valid program ID is required."
    });
  }

  const result =
    await collection.deleteOne({
      _id: id,
      playerId
    });

  if (!result.deletedCount) {
    return res.status(404).json({
      error:
        "Program not found."
    });
  }

  return res.status(200).json({
    success: true
  });
}

async function progressRoute(
  req,
  res,
  db,
  playerId
) {
  if (
    !allowMethods(
      req,
      res,
      ["GET"]
    )
  ) {
    return;
  }

  const ratings =
    await db
      .collection(
        "playerProgress"
      )
      .find({
        playerId
      })
      .sort({
        createdAt: -1
      })
      .toArray();

  return res.status(200).json({
    ratings:
      ratings.map(serialize)
  });
}

module.exports =
  async function handler(
    req,
    res
  ) {
    try {
      const session =
        await requirePlayer(
          req,
          res
        );

      if (!session) {
        return;
      }

      const playerId =
        toObjectId(
          session.userId
        );

      if (!playerId) {
        return res.status(400).json({
          error:
            "Invalid session user ID."
        });
      }

      const db =
        await getDb();

      const route =
        action(req);

      if (route === "me") {
        return meRoute(
          req,
          res,
          db,
          playerId
        );
      }

      if (
        route === "contacts"
      ) {
        return contactsRoute(
          req,
          res,
          db
        );
      }

      if (
        route === "messages"
      ) {
        return messagesRoute(
          req,
          res,
          db,
          playerId
        );
      }

      if (
        route === "programs"
      ) {
        return programsRoute(
          req,
          res,
          db,
          playerId
        );
      }

      if (
        route === "progress"
      ) {
        return progressRoute(
          req,
          res,
          db,
          playerId
        );
      }

      return res.status(404).json({
        error:
          "Player action not found."
      });
    } catch (error) {
      console.error(
        "Player API error:",
        error
      );

      return res.status(500).json({
        error:
          "Player request failed.",

        details:
          error.message
      });
    }
  };