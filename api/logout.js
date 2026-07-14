module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);

        return res.status(405).json({
            message: "Method not allowed."
        });
    }

    res.setHeader(
        "Set-Cookie",
        [
            "collective_session=",
            "Path=/",
            "Max-Age=0",
            "HttpOnly",
            "Secure",
            "SameSite=Strict"
        ].join("; ")
    );

    return res.status(200).json({
        message: "Logged out successfully."
    });
};