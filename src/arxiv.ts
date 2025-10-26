import { requestUrl } from "obsidian";

export interface Paper {
	arxivId: string;
	title: string;
	authors: string[];
	publishedDate: string;
	abstract: string;
	comments: string;
	pdfUrl: string;
}

export async function searchPaper(id: string): Promise<Paper> {
	const url = `https://export.arxiv.org/api/query?id_list=${id}`;

	const response = await requestUrl({ url });
	const parser = new DOMParser();
	const xml = parser.parseFromString(response.text, "text/xml");

	const entry = xml.querySelector("entry")!;

	const title = entry.querySelector("title")?.textContent?.trim();

	if (!title || title === "Error") {
		const message =
			entry.querySelector("summary")?.textContent?.trim() ||
			"Unknown error";
		throw new Error(message);
	}

	const authors = Array.from(entry.querySelectorAll("author")).map(
		(author) => {
			const name =
				author.querySelector("name")?.textContent?.trim() ||
				"Unknown author";
			return name;
		},
	);

	const publishedDate = entry.querySelector("published")?.textContent?.trim() || "";

	const abstract =
		entry
			.querySelector("summary")
			?.textContent?.trim()
			.replace(/\n/g, " ")
			.replace(/"/g, "'") || "No abstract available";

	const comments = entry.querySelector("comment")?.textContent?.trim() || "";

	const arxivId = entry.querySelector("id")?.textContent?.split("abs/")?.pop()?.trim() || "";

	const pdfUrl =
		entry
			.querySelector("link[title='pdf']")
			?.getAttribute("href")
			?.trim()
			?.replace(/^http:\/\//i, "https://") || "";

	return {
		arxivId,
		title,
		authors,
		publishedDate,
		abstract,
		comments,
		pdfUrl,
	};
}
