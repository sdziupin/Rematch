package expo.modules.rematchhealth

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** A finished REMATCH session, as JavaScript hands it over. Times are epoch milliseconds. */
class WorkoutRecord : Record {
  @Field var start: Double = 0.0
  @Field var end: Double = 0.0
  @Field var activity: String = "hiit"
  @Field var energyKcal: Double? = null

  /** [pausedAt, resumedAt] pairs; a pause with no resume runs to `end`. */
  @Field var pauses: List<List<Double>> = emptyList()
  @Field var externalId: String = ""
  @Field var title: String = ""
  @Field var notes: String? = null
}
