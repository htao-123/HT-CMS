export function encodeGitHubContentsPath(filePath: string): string {
  return filePath.split("/").map(encodeURIComponent).join("/");
}
