namespace $ {

	export type $bog_rec_clock_task = {
		id: number
		at: number
		task: ()=> void
	}

	/**
	 * Виртуальные часы: время стоит, пока его не двигают.
	 * Плеер подменяет ими таймеры и кадры внутри фрейма, поэтому проигрывание
	 * не зависит ни от скорости машины, ни от того, свёрнута ли вкладка.
	 */
	export class $bog_rec_clock extends $mol_object2 {

		/** Смещение от старта сессии, мс. */
		now = 0

		serial = 0

		queue = [] as $bog_rec_clock_task[]

		/** Занять идентификатор заранее, чтобы переставляемый таймер сохранял его. */
		reserve() {
			return ++ this.serial
		}

		plan( delay: number, task: ()=> void, id = this.reserve() ) {
			this.queue.push({ id, at: this.now + Math.max( 0, delay ), task })
			return id
		}

		drop( id?: number ) {
			if( id === undefined ) return
			const index = this.queue.findIndex( task => task.id === id )
			if( index >= 0 ) this.queue.splice( index, 1 )
		}

		/** Ближайший запланированный момент. */
		nearest() {
			let found = Number.POSITIVE_INFINITY
			for( const task of this.queue ) if( task.at < found ) found = task.at
			return found
		}

		/**
		 * Прокрутить время до момента, выполнив всё, что успело созреть.
		 * Задачи, поставленные во время прокрутки, тоже выполняются, если попали в окно.
		 */
		warp( till: number, limit = 10000 ) {

			for( let guard = 0; guard < limit; ++ guard ) {

				let next = null as null | $bog_rec_clock_task
				for( const task of this.queue ) {
					if( task.at > till ) continue
					if( !next ) { next = task; continue }
					if( task.at < next.at ) next = task
					else if( task.at === next.at && task.id < next.id ) next = task
				}

				if( !next ) break

				this.drop( next.id )
				this.now = Math.max( this.now, next.at )

				try {
					next.task()
				} catch( error ) {
					$mol_fail_log( error )
				}

			}

			this.now = Math.max( this.now, till )

		}

	}

}
