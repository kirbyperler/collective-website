import { next } from "@vercel/functions";

type SessionPayload = {
    userId: string | null;
    role: "Admin" | "Player" | "Coach" | "Advisor";
    expiresAt: number;
};

function readCookie(
    request: Request,
    cookieName: string
): string | null {
    const cookieHeader =
        request.headers.get("cookie") || "";

    const cookies =
        cookieHeader.split(";");

    for (const cookie of cookies) {
        const [name, ...valueParts] =
            cookie.trim().split("=");

        if (name === cookieName) {
            return (
                valueParts.join("=") ||
                null
            );
        }
    }

    return null;
}

function decodeBase64Url(
    value: string
): ArrayBuffer {
    const base64 =
        value
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const padded =
        base64 +
        "=".repeat(
            (4 - base64.length % 4) % 4
        );

    const binary =
        atob(padded);

    const bytes =
        Uint8Array.from(
            binary,
            function(character) {
                return character.charCodeAt(0);
            }
        );

    return bytes.buffer;
}

function decodePayload(
    value: string
): SessionPayload {
    const decodedBuffer =
        decodeBase64Url(value);

    const decodedText =
        new TextDecoder().decode(
            decodedBuffer
        );

    return JSON.parse(
        decodedText
    );
}

async function getSession(
    request: Request
): Promise<SessionPayload | null> {
    try {
        const secret =
            process.env.SESSION_SECRET;

        if (!secret) {
            return null;
        }

        const token =
            readCookie(
                request,
                "collective_session"
            );

        if (!token) {
            return null;
        }

        const parts =
            token.split(".");

        if (parts.length !== 2) {
            return null;
        }

        const encodedPayload =
            parts[0];

        const encodedSignature =
            parts[1];

        const key =
            await crypto.subtle.importKey(
                "raw",
                new TextEncoder()
                    .encode(secret),
                {
                    name: "HMAC",
                    hash: "SHA-256"
                },
                false,
                ["verify"]
            );

        const signatureIsValid =
            await crypto.subtle.verify(
                "HMAC",
                key,
                decodeBase64Url(
                    encodedSignature
                ),
                new TextEncoder()
                    .encode(
                        encodedPayload
                    )
            );

        if (!signatureIsValid) {
            return null;
        }

        const payload =
            decodePayload(
                encodedPayload
            );

        if (
            !payload.expiresAt ||
            payload.expiresAt <= Date.now()
        ) {
            return null;
        }

        return payload;
    } catch (error) {
        console.error(
            "Session verification error:",
            error
        );

        return null;
    }
}

function requiredRole(
    pathname: string
): SessionPayload["role"] | null {
    if (
        pathname === "/admin" ||
        pathname === "/admin.html" ||
        pathname.startsWith(
            "/api/admin"
        )
    ) {
        return "Admin";
    }

    if (
        pathname === "/player" ||
        pathname === "/player.html" ||
        pathname === "/dashboard" ||
        pathname === "/dashboard.html" ||
        pathname.startsWith(
            "/api/player"
        )
    ) {
        return "Player";
    }

    if (
        pathname === "/coach" ||
        pathname === "/coach.html"
    ) {
        return "Coach";
    }

    if (
        pathname === "/advisor" ||
        pathname === "/advisor.html"
    ) {
        return "Advisor";
    }

    return null;
}

function requiresSession(
    pathname: string
): boolean {
    return (
        pathname === "/admin" ||
        pathname === "/admin.html" ||
        pathname === "/player" ||
        pathname === "/player.html" ||
        pathname === "/dashboard" ||
        pathname === "/dashboard.html" ||
        pathname === "/coach" ||
        pathname === "/coach.html" ||
        pathname === "/advisor" ||
        pathname === "/advisor.html" ||
        pathname.startsWith(
            "/api/admin"
        ) ||
        pathname.startsWith(
            "/api/player"
        ) ||
        pathname === "/api/files" ||
        pathname === "/api/users" ||
        pathname === "/api/messages" ||
        pathname === "/api/accept-inquiry" ||
        (
            pathname === "/api/inquiries"
        )
    );
}

function correctDashboardForRole(
    role: SessionPayload["role"]
): string {
    const dashboards = {
        Admin: "/admin",
        Player: "/player",
        Coach: "/coach",
        Advisor: "/advisor"
    };

    return dashboards[role];
}

export default async function middleware(
    request: Request
) {
    const url =
        new URL(request.url);

    const pathname =
        url.pathname;

    /*
     * Public visitors may submit inquiries.
     */
    if (
        pathname === "/api/inquiries" &&
        request.method === "POST"
    ) {
        return next();
    }

    /*
     * Public auth routes must be allowed through.
     */
    if (
        pathname === "/api/auth" ||
        pathname === "/api/login" ||
        pathname === "/api/logout" ||
        pathname ===
            "/api/complete-account-setup"
    ) {
        return next();
    }

    const routeRequiresSession =
        requiresSession(pathname);

    if (!routeRequiresSession) {
        return next();
    }

    const session =
        await getSession(request);

    if (!session) {
        if (
            pathname.startsWith(
                "/api/"
            )
        ) {
            return Response.json(
                {
                    message:
                        "Unauthorized."
                },
                {
                    status: 401
                }
            );
        }

        return Response.redirect(
            new URL(
                "/login",
                request.url
            ),
            302
        );
    }

    const roleNeeded =
        requiredRole(pathname);

    /*
     * /api/files is shared by players and staff.
     * The API route itself checks ownership and permissions.
     */
    const sharedFilesRoute =
        pathname === "/api/files";

    if (
        roleNeeded &&
        !sharedFilesRoute &&
        session.role !== roleNeeded
    ) {
        if (
            pathname.startsWith(
                "/api/"
            )
        ) {
            return Response.json(
                {
                    message:
                        "Forbidden."
                },
                {
                    status: 403
                }
            );
        }

        return Response.redirect(
            new URL(
                correctDashboardForRole(
                    session.role
                ),
                request.url
            ),
            302
        );
    }

    return next();
}

export const config = {
    matcher: [
        "/admin",
        "/admin.html",

        "/player",
        "/player.html",

        "/dashboard",
        "/dashboard.html",

        "/coach",
        "/coach.html",

        "/advisor",
        "/advisor.html",

        "/api/auth",
        "/api/login",
        "/api/logout",
        "/api/complete-account-setup",

        "/api/users",
        "/api/inquiries",
        "/api/messages",
        "/api/files",
        "/api/accept-inquiry",

        "/api/admin/:path*",
        "/api/player/:path*"
    ]
};