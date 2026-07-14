const {
    createHmac,
    scryptSync,
    timingSafeEqual
} = require("crypto");

const { getDb } = require("./db");

function verifyPassword(password, storedPasswordHash) {
    if (
        typeof password !== "string" ||
        typeof storedPasswordHash !== "string"
    ) {
        return false;
    }

    const parts = storedPasswordHash.split(":");

    if (parts.length !== 2) {
        return false;
    }

    const salt = parts[0];
    const storedHashHex = parts[1];

    const attemptedHash = scryptSync(
        password,
        salt,
        64
    );

    const storedHash = Buffer.from(
        storedHashHex,
        "hex"
    );

    if (attemptedHash.length !== storedHash.length) {
        return false;
    }

    return timingSafeEqual(
        attemptedHash,
        storedHash
    );
}

function normalizeRole(role) {
    const value = String(role || "").toLowerCase();

    if (value === "admin") return "Admin";
    if (value === "player") return "Player";
    if (value === "coach") return "Coach";
    if (value === "advisor") return "Advisor";

    return null;
}

function getRedirectPath(role) {
    if (role === "Admin") return "/admin";
    if (role === "Player") return "/player";
    if (role === "Coach") return "/coach";
    if (role === "Advisor") return "/advisor";

    return null;
}

function createSessionToken(sessionData) {
    const secret = process.env.SESSION_SECRET;

    if (!secret) {
        throw new Error("SESSION_SECRET is missing.");
    }

    const payload = {
        ...sessionData,

        // Eight-hour session.
        expiresAt: Date.now() + 8 * 60 * 60 * 1000
    };

    const encodedPayload = Buffer
        .from(JSON.stringify(payload))
        .toString("base64url");

    const signature = createHmac(
        "sha256",
        secret
    )
        .update(encodedPayload)
        .digest("base64url");

    return `${encodedPayload}.${signature}`;
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);

        return res.status(405).json({
            message: "Method not allowed."
        });
    }

    try {
        const {
            username,
            password
        } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required."
            });
        }

        const normalizedUsername = String(username)
            .trim()
            .toLowerCase();

        if (
          !process.env.ADMIN_USERNAME ||
          !process.env.ADMIN_PASSWORD_HASH ||
          !process.env.SESSION_SECRET
      ) {
          console.error("Authentication environment variables are missing.");

          return res.status(500).json({
            message: "Authentication is not configured."
          });
      }

        let role;
        let userId = null;
        let passwordHash;

        /*
         * Admin account:
         * username and password hash come from Vercel.
         */
        if (
            normalizedUsername ===
            String(process.env.ADMIN_USERNAME || "")
                .trim()
                .toLowerCase()
        ) {
            role = "Admin";
            passwordHash =
                process.env.ADMIN_PASSWORD_HASH;
        } else {
            /*
             * Player, coach, or advisor:
             * their email is their username.
             */
            const db = await getDb();

            const user = await db
                .collection("users")
                .findOne({
                    email: normalizedUsername
                });

            if (user) {
                role = normalizeRole(user.type);
                userId = String(user._id);
                passwordHash = user.passwordHash;
            }
        }

        const passwordIsCorrect = verifyPassword(
            password,
            passwordHash
        );

        if (
            !role ||
            !passwordIsCorrect
        ) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        const redirectTo = getRedirectPath(role);

        if (!redirectTo) {
            return res.status(403).json({
                message:
                    "This account does not have an assigned dashboard."
            });
        }

        const sessionToken = createSessionToken({
            userId,
            role
        });

        const maxAge = 8 * 60 * 60;

        res.setHeader(
            "Set-Cookie",
            [
                `collective_session=${sessionToken}`,
                "Path=/",
                `Max-Age=${maxAge}`,
                "HttpOnly",
                "Secure",
                "SameSite=Strict"
            ].join("; ")
        );

        return res.status(200).json({
            message: "Login successful.",
            redirectTo
        });
    } catch (error) {
        console.error("Login API error:", error);

        return res.status(500).json({
            message: "Server error."
        });
    }
};