const {
    createHmac,
    scryptSync,
    timingSafeEqual
} = require("crypto");

const bcrypt = require("bcryptjs");
const { getDb } = require("./db");

/*
 * Used for the admin password stored in Vercel.
 * Your existing admin password uses:
 *
 * salt:hash
 */
function verifyScryptPassword(
    password,
    storedPasswordHash
) {
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

/*
 * Player, coach, and advisor passwords were created
 * using bcryptjs during account setup.
 */
async function verifyUserPassword(
    password,
    storedPasswordHash
) {
    if (
        typeof password !== "string" ||
        typeof storedPasswordHash !== "string"
    ) {
        return false;
    }

    try {
        return await bcrypt.compare(
            password,
            storedPasswordHash
        );
    } catch (error) {
        console.error(
            "Password comparison error:",
            error
        );

        return false;
    }
}

function normalizeRole(role) {
    const value = String(role || "")
        .trim()
        .toLowerCase();

    if (value === "admin") return "Admin";
    if (value === "player") return "Player";
    if (value === "coach") return "Coach";
    if (value === "advisor") return "Advisor";

    return null;
}

function getRedirectPath(role) {
    if (role === "Admin") return "/admin";
    if (role === "Player") return "/dashboard";
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
        expiresAt:
            Date.now() + 8 * 60 * 60 * 1000
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

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !password
        ) {
            return res.status(400).json({
                message:
                    "Username and password are required."
            });
        }

        if (!process.env.SESSION_SECRET) {
            console.error(
                "SESSION_SECRET is missing."
            );

            return res.status(500).json({
                message:
                    "Authentication is not configured."
            });
        }

        const normalizedUsername =
            username.trim().toLowerCase();

        const adminUsername = String(
            process.env.ADMIN_USERNAME || ""
        )
            .trim()
            .toLowerCase();

        let role = null;
        let userId = null;
        let passwordIsCorrect = false;

        /*
         * Check the separate admin account first.
         */
        if (
            adminUsername &&
            normalizedUsername === adminUsername
        ) {
            if (!process.env.ADMIN_PASSWORD_HASH) {
                console.error(
                    "ADMIN_PASSWORD_HASH is missing."
                );

                return res.status(500).json({
                    message:
                        "Admin authentication is not configured."
                });
            }

            role = "Admin";

            passwordIsCorrect =
                verifyScryptPassword(
                    password,
                    process.env.ADMIN_PASSWORD_HASH
                );
        } else {
            /*
             * Player, coach, or advisor account.
             *
             * The account setup process stores:
             * usernameLower
             * passwordHash
             * accountStatus
             */
            const db = await getDb();

            const user = await db
                .collection("users")
                .findOne({
                    usernameLower:
                        normalizedUsername
                });

            if (user) {
                role = normalizeRole(user.type);
                userId = String(user._id);

                /*
                 * Only activated accounts may log in.
                 */
                if (user.accountStatus !== "Active") {
                    return res.status(403).json({
                        message:
                            "This account has not been activated."
                    });
                }

                passwordIsCorrect =
                    await verifyUserPassword(
                        password,
                        user.passwordHash
                    );
            }
        }

        /*
         * Keep the response generic so it does not reveal
         * whether a username exists.
         */
        if (
            !role ||
            !passwordIsCorrect
        ) {
            return res.status(401).json({
                message:
                    "Invalid username or password."
            });
        }

        const redirectTo =
            getRedirectPath(role);

        if (!redirectTo) {
            return res.status(403).json({
                message:
                    "This account does not have an assigned dashboard."
            });
        }

        const sessionToken =
            createSessionToken({
                userId,
                role
            });

        const maxAge =
            8 * 60 * 60;

        const cookieParts = [
            `collective_session=${sessionToken}`,
            "Path=/",
            `Max-Age=${maxAge}`,
            "HttpOnly",
            "SameSite=Strict"
        ];

        /*
         * Secure cookies require HTTPS.
         * Vercel production uses HTTPS.
         */
        if (process.env.NODE_ENV === "production") {
            cookieParts.push("Secure");
        }

        res.setHeader(
            "Set-Cookie",
            cookieParts.join("; ")
        );

        return res.status(200).json({
            message: "Login successful.",
            redirectTo
        });
    } catch (error) {
        console.error(
            "Login API error:",
            error
        );

        return res.status(500).json({
            message: "Server error."
        });
    }
};