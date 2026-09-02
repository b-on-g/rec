namespace $.$$ {

	/** Приложение, на котором удобно проверять запись и проигрывание. */
	export class $bog_rec_demo extends $.$bog_rec_demo {

		@ $mol_mem
		count( next?: number ) {
			return next ?? 0
		}

		value_text() {
			return String( this.count() )
		}

		less() {
			this.count( this.count() - 1 )
		}

		more() {
			this.count( this.count() + 1 )
		}

		@ $mol_mem
		name( next?: string ) {
			return next ?? ''
		}

		hello() {
			const name = this.name().trim()
			return name ? `Здравствуйте, ${ name }!` : 'Представьтесь, пожалуйста.'
		}

		@ $mol_action
		save() {
			const session = $bog_rec_take.stop()
			if( session ) this.download( session )
			$bog_rec_take.start()
		}

		@ $mol_action
		fuzz() {
			const report = $mol_wire_sync( $bog_rec_fuzz ).run({
				root: this,
				steps: 40,
				allow: view => view !== this.Save() && view !== this.Fuzz(),
			})
			if( report.session ) this.download( report.session )
			$bog_rec_take.start()
		}

		download( session: $bog_rec_session ) {

			const doc = this.$.$mol_dom_context.document
			const blob = new Blob([ $bog_rec.text( session ) ], { type: 'application/json' })
			const uri = URL.createObjectURL( blob )

			const link = doc.createElement( 'a' )
			link.href = uri
			link.download = `${ session.root }-${ session.id }.rec.json`
			link.click()

			URL.revokeObjectURL( uri )

		}

	}

}
