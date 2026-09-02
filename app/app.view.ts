namespace $.$$ {

	/**
	 * Просмотрщик записанных сессий.
	 *
	 * Слева лог воздействий, справа то же приложение, поднятое тем же бандлом
	 * в изолированном фрейме с подменёнными часами, сетью и хранилищами.
	 */
	export class $bog_rec_app extends $.$bog_rec_app {

		@ $mol_mem
		files( next?: readonly File[] ): readonly File[] {
			return next ?? []
		}

		@ $mol_mem
		session(): $bog_rec_session | null {
			const files = this.files()
			if( !files.length ) return null
			return $bog_rec.parse( $mol_wire_sync( files[0] ).text() )
		}

		/** Номер прогона: смена пересоздаёт и плеер, и фрейм. */
		@ $mol_mem
		generation( next?: number ) {
			return next ?? 0
		}

		/** Счётчик шагов, чтобы сводка обновлялась вслед за проигрыванием. */
		@ $mol_mem
		beat( next?: number ) {
			return next ?? 0
		}

		@ $mol_mem
		playing( next?: boolean ) {
			return next ?? false
		}

		@ $mol_mem
		player(): $bog_rec_play | null {
			const session = this.session()
			if( !session ) return null
			this.generation()
			return $bog_rec_play.make({ session })
		}

		@ $mol_mem
		screen() {
			const player = this.player()
			if( !player ) return ''
			/// Крючок должен встать в окно раньше, чем фрейм получит разметку
			player.hook()
			return player.html( this.generation() )
		}

		toggle_title() {
			return this.playing() ? '❚❚' : '▶'
		}

		@ $mol_mem
		rows() {
			const session = this.session()
			if( !session ) return []
			return session.events.map( ( event, index )=> this.Row( index ) )
		}

		row_title( index: number ) {
			const session = this.session()
			if( !session ) return ''
			const event = session.events[ index ]
			const mark = index < this.cursor() ? '· ' : '  '
			return `${ mark }${ event.time } мс  ${ event.kind }  ${ event.view }`
		}

		cursor() {
			this.beat()
			return this.player()?.progress() ?? 0
		}

		@ $mol_mem
		status() {

			this.beat()

			const session = this.session()
			if( !session ) return 'Откройте запись сессии.'

			const player = this.player()
			const misses = player?.misses ?? []
			const errors = player?.errors() ?? []

			return [
				`**${ session.root }** · ${ session.events.length } событий · ${ $bog_rec.duration( session ) } мс`,
				`Проиграно: ${ this.cursor() }`,
				... misses.length ? [ `Пропуски: ${ misses.length }`, ... misses.slice( 0, 5 ) ] : [],
				... errors.length ? [ `Ошибки на экране:`, ... errors.slice( 0, 5 ) ] : [],
			].join( '\n\n' )

		}

		pulse() {
			this.beat( this.beat() + 1 )
		}

		@ $mol_action
		step() {
			const player = this.player()
			if( !player ) return
			player.step()
			this.pulse()
		}

		@ $mol_action
		restart() {
			this.playing( false )
			this.generation( this.generation() + 1 )
			this.pulse()
		}

		@ $mol_action
		row_seek( index: number ) {

			const player = this.player()
			if( !player ) return

			this.playing( false )

			if( index < player.progress() ) {
				this.rewind( index + 1 )
			} else {
				$mol_wire_sync( player ).seek( index + 1 )
			}

			this.pulse()

		}

		/** Назад отматываем пересборкой: проигрывание детерминировано, снимки не нужны. */
		rewind( index: number ) {
			this.generation( this.generation() + 1 )
			const player = this.player()
			if( !player ) return
			$mol_wire_sync( player ).ready()
			$mol_wire_sync( player ).seek( index )
		}

		@ $mol_action
		toggle() {
			const next = !this.playing()
			this.playing( next )
			if( next ) this.run()
		}

		run() {

			const player = this.player()
			if( !player ) return

			const loop = async ()=> {
				while( this.playing() && !player.done() ) {
					player.step()
					await player.settle()
					this.pulse()
				}
				this.playing( false )
			}

			loop().catch( error => $mol_fail_log( error ) )

		}

	}

}
