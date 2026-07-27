<script lang="ts">
	import { cn } from "$lib/utils";
	import { useStepperItem } from "$lib/components/ui/stepper/stepper.svelte.js";
	import type { StepperItemProps } from "$lib/components/ui/stepper/types";

	const uid = $props.id();

	let {
		id = uid,
		class: className,
		children,
		...rest
	}: StepperItemProps = $props();

	const stepperItemState = useStepperItem({
		get id() {
			return id;
		},
	});
</script>

<div
	data-slot="stepper-item"
	class={cn(
		"group/stepper-item relative flex",
		"group-data-[orientation=horizontal]/stepper-nav:flex-1 group-data-[orientation=horizontal]/stepper-nav:flex-col group-data-[orientation=horizontal]/stepper-nav:items-center",
		{
			"flex-1": !stepperItemState.isLast,
		},
		className,
	)}
	{...stepperItemState.props}
	{...rest}
>
	{@render children?.()}
</div>
