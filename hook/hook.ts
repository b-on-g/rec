namespace $ {

	export type $bog_rec_hook_events = Record< string, ( event: Event )=> unknown >

	export type $bog_rec_hook_method = (
		( this: $mol_view )=> $bog_rec_hook_events
	) & {
		/** Исходное тело метода, которое `$mol_wire_solo` кладёт рядом с мемоизированным. */
		orig?: ( this: $mol_view )=> $bog_rec_hook_events
	}

	export type $bog_rec_hook_sink = {
		/** Вид получил слушателей, то есть впервые попал в DOM. */
		mount?: ( view: $mol_view )=> void
		/** По виду щёлкнули, напечатали и так далее. */
		event?: ( view: $mol_view, kind: string, event: Event )=> void
	}

	/**
	 * Единственная точка, через которую проходят все пользовательские события $mol-приложения.
	 *
	 * Подменяет `event_async` у `$mol_view`, сохраняя мемоизацию: `destructor` снимает
	 * слушатели по ссылкам из той же ячейки, поэтому возвращать каждый раз новый объект нельзя.
	 *
	 * Контекст передаётся снаружи, так что прицепиться можно и к своей странице,
	 * и к `$` из iframe с чужим бандлом.
	 */
	export class $bog_rec_hook extends $mol_object {

		static patched = new WeakSet< object >()

		static sinks = new WeakMap< object, $bog_rec_hook_sink[] >()

		/** Возвращает функцию отцепления. */
		static attach( context: $, sink: $bog_rec_hook_sink ) {

			const proto = context.$mol_view.prototype

			let sinks = this.sinks.get( proto )
			if( !sinks ) this.sinks.set( proto, sinks = [] )
			sinks.push( sink )

			if( !this.patched.has( proto ) ) {
				this.patched.add( proto )
				this.patch( context, proto )
			}

			return ()=> this.detach( proto, sink )

		}

		static detach( proto: object, sink: $bog_rec_hook_sink ) {
			const sinks = this.sinks.get( proto )
			if( !sinks ) return
			const index = sinks.indexOf( sink )
			if( index >= 0 ) sinks.splice( index, 1 )
		}

		static notify( proto: object, pick: ( sink: $bog_rec_hook_sink )=> void ) {
			for( const sink of this.sinks.get( proto ) ?? [] ) {
				try {
					pick( sink )
				} catch( error ) {
					$mol_fail_log( error )
				}
			}
		}

		static patch( context: $, proto: $mol_view ) {

			const current = Reflect.get( proto, 'event_async' ) as $bog_rec_hook_method
			const base = current.orig ?? current
			const all = this

			context.$mol_mem( proto, 'event_async', {
				configurable: true,
				value: function event_async( this: $mol_view ) {

					const events = base.call( this )
					const hooked = {} as $bog_rec_hook_events

					for( const kind in events ) {
						const handler = events[ kind ]
						hooked[ kind ] = ( event: Event )=> {
							all.notify( proto, sink => sink.event?.( this, kind, event ) )
							return handler( event )
						}
					}

					all.notify( proto, sink => sink.mount?.( this ) )

					return hooked

				},
			} )

		}

	}

}
