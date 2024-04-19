// #region IMPORTS
import type { ITrack } from './types';
import type Armature   from '../armature/Armature';

import { EventType, LerpType }  from './types';
import AnimationEvent           from './AnimationEvent';
import RootMotion               from './RootMotion';
import TrackQuat                from './TrackQuat';
import TrackVec3 from './TrackVec3';
// #endregion

export default class Clip{
    // #region MAIN
    name        : string                     = '';          // Clip Name
    frameCount  : number                     = 0;           // Total frames in animation
    duration    : number                     = 0;           // Total animation time
    timeStamps  : Array< ArrayLike<number> > = [];          // Different sets of shared time stamps
    tracks      : Array< ITrack >            = [];          // Collection of animations broke out as Rotation, Position & Scale
    events     ?: Array< AnimationEvent >    = undefined;   // Collection of animation events
    rootMotion ?: RootMotion                 = undefined;   // Root motion for this animation
    isLooped    : boolean                    = true;        // Is the animation to run in a loop

    constructor( name: string = '' ){
        this.name = name;
    }
    // #endregion

    // #region EVENTS
    addEvent( name:string, start: number, eventType: number = EventType.Frame, duration: number = -1 ): this{
        if( !this.events ) this.events = [];
        this.events.push( new AnimationEvent( name, start, eventType, duration ) );
        return this;
    }

    setRootMotionData( data: ArrayLike<number> ){
        const rm = new RootMotion( data );

        // Find which timestamp array that best fits root motion
        for( let i=0; i < this.timeStamps.length; i++ ){
            if( this.timeStamps[i].length === rm.frameCount ){
                rm.timeStampIdx = i;
                break;
            }
        }

        this.rootMotion = rm;
        return this
    }
    // #endregion

    // #region METHODS
    timeAtFrame( f: number ): number{
        // Since there is a chance to have more then one time stamp,
        // use the first one that matches up with the max frame count
        if( f >=0 && f < this.frameCount ){
            for( const ts of this.timeStamps ){
                if( ts.length === this.frameCount ) return ts[ f ];
            }
        }  

        return -1;
    }
    // #endregion

    // #region DEBUG
    debugInfo( arm ?: Armature ){
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        const pose          = arm?.bindPose;
        const lerpKeys      = Object.keys( LerpType );

        // @ts-ignore
        const getLerpName   = ( v: number ): any => lerpKeys.find( k=>LerpType[k] === v );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        let bName     = '';
        let trackType = '';

        console.log( 'Clip Name [ %s ] \t Track Count [ %d ] \t Max frames [ %d ]'
            , this.name
            , this.tracks.length
            , this.frameCount
        );

        for( const t of this.tracks ){
            if( pose ) bName = pose.bones[ t.boneIndex ].name;
            if( t instanceof TrackQuat )        trackType = 'quat';
            else if( t instanceof TrackVec3 )   trackType = 'vec3';
            else                                trackType = 'Unknown';

            // console.log( bName, trackType, this.timeStamps[ t.timeIndex ].length, getLerpName( t.lerpType ), t );
            
            console.log( 'Bone [ %s ] \t Type [ %s ] \t Lerp Type [ %s ] \t Frames [ %d ]'
                , bName
                , trackType
                , getLerpName( t.lerpType )
                , this.timeStamps[ t.timeIndex ].length
            );
        }
    }
    // #endregion
}
