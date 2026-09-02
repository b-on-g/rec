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
			if( files.length ) return $bog_rec.parse( $mol_wire_sync( files[0] ).text() )

			/// Запись можно открыть и по адресу: `#!rec=https://.../session.rec.json`
			const uri = this.$.$mol_state_arg.value( 'rec' )
			if( uri ) return $bog_rec.parse( this.$.$mol_fetch.text( uri ) )

			return null

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
				`Проиграно: ${ this.cursor() } из ${ session.events.length }`,
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

		/** Шаг назад: фрейм пересобирается и быстро проигрывается до предыдущего события. */
		@ $mol_action
		back() {
			const player = this.player()
			if( !player ) return
			this.playing( false )
			this.rewind( Math.max( 0, player.progress() - 1 ) )
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

			if( index < player.progress() ) this.rewind( index + 1 )
			else this.forward( index + 1 )

		}

		/**
		 * Назад отматываем пересборкой фрейма: проигрывание детерминировано, снимки не нужны.
		 *
		 * Ожидание вынесено из фибры намеренно. Подвисающее чтение внутри `@ $mol_action`
		 * заставило бы тело перезапуститься, а вместе с ним и инкремент прогона — вечный цикл.
		 */
		rewind( index: number ) {
			this.generation( this.generation() + 1 )
			const player = this.player()
			if( !player ) return
			this.drive( player, async ()=> {
				await player.ready()
				await player.seek( index )
			} )
		}

		forward( index: number ) {
			const player = this.player()
			if( !player ) return
			this.drive( player, ()=> player.seek( index ) )
		}

		drive( player: $bog_rec_play, task: ()=> Promise< unknown > ) {
			task().then(
				()=> this.pulse(),
				error => $mol_fail_log( error ),
			)
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
