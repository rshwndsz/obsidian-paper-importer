<script lang="ts">
	interface Props {
		onkeypress?: (event: KeyboardEvent, paperUri: string) => void;
		states: Record<string, any>;
		downloadPdf?: boolean;
	}
	let { onkeypress, states, downloadPdf = true }: Props = $props();

	let paperUri: string = $state("");
	let logContainer: HTMLDivElement | null = $state(null);

	// Auto-scroll to bottom when new messages are added
	$effect(() => {
		if (states.logs && states.logs.length > 0) {
			// Use requestAnimationFrame to ensure DOM is updated
			requestAnimationFrame(() => {
				if (logContainer) {
					logContainer.scrollTop = logContainer.scrollHeight;
				}
			});
		}
	});

	function getLogLevelStyle(logLevel: string) {
		const level = logLevel.toLowerCase();

		switch (level) {
			case "error":
			case "err":
				return {
					bg: "rgba(255, 59, 48, 0.1)",
					color: "rgb(255, 69, 58)",
				};
			case "warn":
			case "warning":
				return {
					bg: "rgba(255, 149, 0, 0.1)",
					color: "rgb(255, 159, 10)",
				};
			case "info":
			case "information":
				return {
					bg: "rgba(0, 122, 255, 0.1)",
					color: "rgb(10, 132, 255)",
				};
			case "success":
			case "ok":
				return {
					bg: "rgba(52, 199, 89, 0.1)",
					color: "rgb(48, 209, 88)",
				};
			case "debug":
				return {
					bg: "rgba(175, 82, 222, 0.1)",
					color: "rgb(191, 90, 242)",
				};
			default:
				return {
					bg: "var(--background-modifier-border)",
					color: "var(--text-muted)",
				};
		}
	}
</script>

<h4>
	{downloadPdf ? "Import Paper from arXiv" : "Import Metadata from arXiv"}
</h4>
<p style="margin-bottom: 20px; color: grey;">
	Enter the arXiv ID or URL of the paper you want to import.
	{downloadPdf
		? "The PDF will be downloaded and metadata will be created."
		: "Only metadata will be imported, no PDF download."}
	Press Enter to confirm.
</p>

<input
	type="text"
	bind:value={paperUri}
	onkeypress={(event: KeyboardEvent) => {
		onkeypress?.(event, paperUri);
	}}
	placeholder="arXiv ID or URL"
	style="width: 100%;"
/>

<!-- Download Progress Bar -->
{#if downloadPdf && states.downloadProgress !== undefined && states.downloadProgress > 0}
	<div style="margin-top: 20px;">
		<div
			style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;"
		>
			<span style="font-size: 14px; color: var(--text-muted);"
				>Download Progress</span
			>
			<span style="font-size: 14px; color: var(--text-muted);">
				{Math.round(states.downloadProgress)}%
			</span>
		</div>
		<div
			style="width: 100%; background-color: var(--background-modifier-border); border-radius: 4px; height: 8px; overflow: hidden;"
		>
			<div
				style="height: 100%; background-color: var(--interactive-accent); transition: width 0.3s ease; width: {states.downloadProgress}%;"
			></div>
		</div>
	</div>
{/if}

<!-- State Messages (Logs) -->
{#if states.logs && states.logs.length > 0}
	<div style="margin-top: 20px;">
		<div
			style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px;"
		>
			Status:
		</div>
		<div
			bind:this={logContainer}
			style="max-height: 120px; overflow-y: auto; background-color: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 10px;"
		>
			{#each states.logs as [logLevel, message]}
				{@const logStyle = getLogLevelStyle(logLevel)}
				<div
					style="font-size: 13px; margin-bottom: 4px; font-family: var(--font-monospace); display: flex; align-items: flex-start; gap: 8px;"
				>
					<span
						style="background-color: {logStyle.bg}; color: {logStyle.color}; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; min-width: 50px; text-align: center; text-transform: uppercase; flex-shrink: 0;"
					>
						{logLevel}
					</span>
					<span
						style="color: var(--text-normal); flex: 1; line-height: 1.4;"
					>
						{message}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
