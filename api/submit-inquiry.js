export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Only POST requests allowed" });
    }

    const inquiry = req.body;

    console.log("New inquiry:", inquiry);

    return res.status(200).json({
        message: "Inquiry received"
    });
}