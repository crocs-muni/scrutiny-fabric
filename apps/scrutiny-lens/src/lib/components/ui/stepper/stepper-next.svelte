<script lang="ts">
	import { box, mergeProps } from 'svelte-toolbelt';
	import { useStepperStepButton } from '$lib/components/ui/stepper/stepper.svelte.js';
	import type { StepperNextButtonProps } from '$lib/components/ui/stepper/types';
	import { Button } from '$lib/components/ui/button';

	let {
		disabled = false,
		child,
		children,
		variant = 'default',
		size = 'default',
		...rest
	}: StepperNextButtonProps = $props();

	const buttonState = useStepperStepButton({
		type: box.with(() => 'next'),
		disabled: box.with(() => disabled)
	});

	const mergedProps = $derived(
		mergeProps(buttonState.props, rest, { variant, size, 'data-slot': 'stepper-next' })
	);
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<Button {...mergedProps}>
		{@render children?.()}
	</Button>
{/if}
