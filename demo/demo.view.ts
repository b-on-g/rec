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

		@ $mol_mem
		report( next?: $bog_rec_fuzz_report ): $bog_rec_fuzz_report | null {
			return next ?? null
		}

		note() {

			const report = this.report()

			const outcome = report
				? [
					`Прокликано шагов: ${ report.steps }, записано событий: ${ report.session?.events.length ?? 0 }.`,
					report.errors.length ? `Ошибки: ${ report.errors.join( ', ' ) }` : 'Ошибок не всплыло.',
				]
				: []

			return [
				... outcome,
				'Кнопка выше — удобство этой демки. В своё приложение рекордер ничего не рисует: там запись забирают из консоли, `$bog_rec_take.save()` скачает файл, `$bog_rec_take.text()` отдаст JSON.',
			].join( '\n\n' )

		}

		@ $mol_action
		save() {
			$bog_rec_take.save()
		}

		@ $mol_action
		fuzz() {

			const report = $mol_wire_sync( $bog_rec_fuzz ).run({
				root: this,
				steps: 40,
				allow: view => view !== this.Fuzz() && view !== this.Save(),
			})

			this.report( report )

			/// Прогон останавливает запись, поэтому заводим следующую
			$bog_rec_take.start()

		}

	}

}
