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

    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {
        const [name, ...valueParts] =
            cookie.trim().split("=");

        if (name === cookieName) {
            return valueParts.join("=") || null;
        }
    }

    return null;
}

function decodeBase64Url(value: string): ArrayBuffer {
    const base64 = value
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const padded =
        base64 +
        "=".repeat((4 - base64.length % 4) % 4);

    const binary = atob(padded);

    const bytes = Uint8Array.from(
        binary,
        character => character.charCodeAt(0)
    );

    return bytes.buffer as ArrayBuffer;
}

function decodePayload(value: string): SessionPayload {
    const decodedBuffer = decodeBase64Url(value);

    const decodedText =
        new TextDecoder().decode(decodedBuffer);

    return JSON.parse(decodedText);
}

async function getSession(
    request: Request
): Promise<SessionPayload | null> {
    try {
        const secret = process.env.SESSION_SECRET;

        if (!secret) {
            return null;
        }

        const token = readCookie(
            request,
            "collective_session"
        );

        if (!token) {
            return null;
        }

        const parts = token.split(".");

        if (parts.length !== 2) {
            return null;
        }

        const encodedPayload = parts[0];
        const encodedSignature = parts[1];

        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secret),
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
                decodeBase64Url(encodedSignature),
                new TextEncoder().encode(encodedPayload)
            );

        if (!signatureIsValid) {
            return null;
        }

        const payload = decodePayload(encodedPayload);

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

function requiredRole(pathname: string) {
    if (
        pathname === "/admin" ||
        pathname === "/admin.html" ||
        pathname === "/api/users" ||
        pathname === "/api/inquiries" ||
        pathname === "/api/messages" ||
        pathname === "/api/files" ||
        pathname === "/api/accept-inquiry" ||
        pathname.startsWith("/api/admin/")
    ) {
        return "Admin";
    }

    if (
        pathname === "/player" ||
        pathname === "/player.html"
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

export default async function middleware(
    request: Request
) {
    const url = new URL(request.url);
    const session = await getSession(request);
    const roleNeeded = requiredRole(url.pathname);

    if (!session) {
        if (url.pathname.startsWith("/api/")) {
            return Response.json(
                {
                    message: "Unauthorized."
                },
                {
                    status: 401
                }
            );
        }

        return Response.redirect(
            new URL("/login.html", request.url),
            302
        );
    }

    if (
        roleNeeded &&
        session.role !== roleNeeded
    ) {
        if (url.pathname.startsWith("/api/")) {
            return Response.json(
                {
                    message: "Forbidden."
                },
                {
                    status: 403
                }
            );
        }

        const correctDashboard = {
            Admin: "/admin",
            Player: "/player",
            Coach: "/coach",
            Advisor: "/advisor"
        }[session.role];

        return Response.redirect(
            new URL(correctDashboard, request.url),
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
        "/coach",
        "/coach.html",
        "/advisor",
        "/advisor.html",
        "/api/users",
        "/api/inquiries",
        "/api/messages",
        "/api/files",
        "/api/accept-inquiry",
        "/api/admin/:path*"
    ]
};