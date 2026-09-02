namespace $.$$ {

	$mol_style_define( $bog_rec_app, {

		Split: {
			flex: {
				direction: 'row',
				grow: 1,
			},
			gap: $mol_gap.block,
			align: { items: 'stretch' },
			minHeight: '32rem',
		},

		Side: {
			flex: {
				direction: 'column',
				basis: '26rem',
				grow: 0,
				shrink: 0,
			},
			minWidth: 0,
			overflow: { x: 'auto' },
			gap: $mol_gap.text,
		},

		Screen: {
			flex: {
				grow: 1,
				shrink: 1,
				basis: 0,
			},
			minWidth: 0,
			border: {
				radius: $mol_gap.round,
			},
			background: {
				color: $mol_theme.card,
			},
		},

		Row: {
			justifyContent: 'flex-start',
			whiteSpace: 'pre',
			font: {
				family: 'monospace',
			},
		},

	} )

	$mol_style_define( $bog_rec_app_screen, {
		border: { width: 0 },
		align: { self: 'stretch' },
	} )

}
