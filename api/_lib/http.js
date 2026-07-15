export function allowMethods(request, response, methods) {
  if (!methods.includes(request.method)) {
    response.setHeader("Allow", methods.join(", "));
    response.status(405).json({ error: "Method not allowed." });
    return false;
  }
  return true;
}

export function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}
