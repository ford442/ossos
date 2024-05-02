// #region IMPORT
import type { BoneInfo }    from '../armature/BoneMap';
import type Bone            from '../armature/Bone';
import type Pose            from '../armature/Pose';

import BoneMap              from '../armature/BoneMap';
import PoseAnimator         from './PoseAnimator';
import Quat                 from '../maths/Quat';
import Vec3                 from '../maths/Vec3';
// #endregion

// #region SUPPORT OBJECTS

/** Links similar bones between two seperate skeletongs */
class BoneLink{
    // #region MAIN
    srcIndex: number = -1;   // Bone index in source tpose
    tarIndex: number = -1;   // Bone index in target tpose

    qSrcParent = new Quat(); // Cache the bone's parent worldspace quat
    qDotCheck  = new Quat(); // Cache the src bone worldspace quat for DOT Check
    qSrcToTar  = new Quat(); // Handles transformation from Src WS to Tar WS
    qTarParent = new Quat(); // Cache tpose parent ws rotation, to make it easy to transform Tar WS to Tar LS

    constructor( srcIdx?:number, tarIdx?:number ){
        if( srcIdx != null ) this.srcIndex = srcIdx;
        if( tarIdx != null ) this.tarIndex = tarIdx;
    }
    // #endregion

    // #region METHODS
    fromBones( src: Bone, tar: Bone ): this{
        this.srcIndex = src.index;
        this.tarIndex = tar.index;
        return this;
    }

    bind( src: Pose, tar: Pose ): this{
        const srcBone = src.bones[ this.srcIndex ];
        const tarBone = tar.bones[ this.tarIndex ];

        // Cache for DOT check
        this.qDotCheck.copy( srcBone.world.rot );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Save worldspace parent for conversion between WS and TS
        this.qSrcParent.copy(
            ( srcBone.pindex !== -1 )
                ? src.bones[ srcBone.pindex ].world.rot
                : src.offset.rot
        );

        // Use for Tar WS to LS, so it needs to be inverted
        this.qTarParent.fromInvert(
            ( tarBone.pindex !== -1 )
                ? tar.bones[ tarBone.pindex ].world.rot
                : tar.offset.rot
        );

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Handle transforming from source TPose to target TPose in worldspace.
        // qConvert = inverted( qSource ) * qTarget;
        this.qSrcToTar
            .fromInvert( srcBone.world.rot )    // What is the diff from Source
            .mul( tarBone.world.rot );          // to target's worldspace rotation

        return this;
    }
    // #endregion
}

// #endregion

export default class Retarget{
    // #region MAIN
    animator = new PoseAnimator();
    links    : Map<string, BoneLink> = new Map();
    srcPose !: Pose;    // Starting "Pose" for both should be very similar for retargeting to work
    tarPose !: Pose;    // ... a TPose is the most ideal pose for retargeting

    srcHip   = new Vec3();  // TODO, Need to handle Root bone too
    tarHip   = new Vec3();
    hipScale = 1;
    // #endregion

    // #region METHODS

    /** Set the tpose for both skeletons */
    useTPoses( src: Pose, tar: Pose ): this{
        // Clone the pose which will be used for targetting
        // Do not want to damage the state of the poses being passed in.
        this.srcPose = src.clone();
        this.tarPose = tar.clone();

        return this;
    }

    bindBone( srcName: string, tarName: string ): this{
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Check if bones exists
        const bSrc = this.srcPose.getBone( srcName );
        const bTar = this.tarPose.getBone( tarName );
        if( !bSrc || !bTar ){ console.log( 'Can not link bones', srcName, tarName ); return this; }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Binding between two bones
        const lnk = new BoneLink()
            .fromBones( bSrc, bTar )            // Save needed bone info
            .bind( this.srcPose, this.tarPose ) // Compute Conversion Transform

        this.links.set( window.crypto.randomUUID(), lnk );
        return this;
    }

    bindBatch( ary: Array<{ src:string, tar:string, incPos ?: boolean }> ): this{
        const pSrc = this.srcPose;
        const pTar = this.tarPose;

        let bSrc    : Bone | null;
        let bTar    : Bone | null;
        let lnk     : BoneLink;
        let lnkName : string;

        for( const i of ary ){
            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Check if bones exists
            bSrc = pSrc.getBone( i.src );
            bTar = pTar.getBone( i.tar );
            if( !bSrc || !bTar ){ console.log( 'Can not link bones', i ); continue; }

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // Bind the two mirroring bones
            lnk = new BoneLink()
                .fromBones( bSrc, bTar )            // Save needed bone info
                .bind( this.srcPose, this.tarPose ) // Compute Conversion Transform

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            // TODO: this is a temp hack to support how to retarget the hip
            // when it moves around. Need to revisit retargeting to try to support
            // change in position but for now this will work for bipedal characters.
            // Also note need to handle ROOT as well.
            if( i.incPos === true ){
                // Store hip Tpose world space position
                this.srcHip.copy( bSrc.world.pos ).nearZero();
                this.tarHip.copy( bTar.world.pos ).nearZero();
    
                // Retarget position scale from Source to target
                this.hipScale = Math.abs( this.srcHip[1] / this.tarHip[1] );

                lnkName = 'hip';
            }else{
                lnkName = window.crypto.randomUUID();
            }

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            this.links.set( lnkName, lnk );
        }
       
        return this;
    }

    autoBindTPoses( src: Pose, tar: Pose ): this{
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Clone poses to reuse to work animation with
        this.srcPose = src.clone();
        this.tarPose = tar.clone();

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Create bone mapping
        const srcBonemap: BoneMap = new BoneMap( src );
        const tarBonemap: BoneMap = new BoneMap( tar );

        // Match up bones from src + tar
        let tarBone: BoneInfo | undefined;
        for( const [key,srcBone] of srcBonemap.bones ){
            tarBone = tarBonemap.bones.get( key );
            if( !tarBone ) continue;

            if( tarBone.isChain || srcBone.isChain ){
                // Spine tends to be a chain of bones
                const srcMax = srcBone.count - 1;
                const tarMax = tarBone.count - 1;
                // ------------------------------------------
                // First item in chain get linked
                this.links.set( key + '_first',
                    new BoneLink( srcBone.index, tarBone.index ).bind( src, tar )
                );

                // Last item in chain get linked
                this.links.set(
                    key + '_last',
                    new BoneLink( 
                        srcBone.items[srcMax].index,
                        tarBone.items[tarMax].index
                    ).bind( src, tar )
                );
                
                // ------------------------------------------
                // Fill the middle bits of whats available of either chain
                for( let i=1; i <= Math.min( srcMax-1, tarMax-1 ); i++ ){
                    this.links.set(
                        key + '_' + i,
                        new BoneLink( 
                            srcBone.items[ i ].index,
                            tarBone.items[ i ].index
                        ).bind( src, tar )
                    );
                }
            }else{
                this.links.set(
                    key, new BoneLink( srcBone.index, tarBone.index ).bind( src, tar )
                );
            }
        }
        
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Data to handle Hip Position Retargeting
        const hip = this.links.get( 'hip' );
        if( hip ){
            const srcBone = src.bones[ hip.srcIndex ];    // TBone State
            const tarBone = tar.bones[ hip.tarIndex ];   

            // Store hip Tpose world space position
            this.srcHip.copy( srcBone.world.pos ).nearZero();
            this.tarHip.copy( tarBone.world.pos ).nearZero();

            // Retarget position scale from Source to target
            this.hipScale = Math.abs( this.srcHip[1] / this.tarHip[1] ); 
        }

        return this;
    }

    // #endregion

    // #region CONTROL ANIMATION
    step( dt: number ) : this{
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Run Animation & Update the FROM Pose with the results
        this.animator
            .step( dt )
            .updatePose( this.srcPose );

        this.srcPose.updateWorld();

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        this.retargetPose();
        this.tarPose.updateWorld();

        return this;
    }
    // #endregion

    // #region CALCULATIONS
    retargetPose(): void{
        const diff = new Quat();
        const tmp  = new Quat();
        let lnk    : BoneLink | undefined;
        let srcBone: Bone;
        let tarBone: Bone;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        for( lnk of this.links.values() ){
            // ---------------------------------------
            srcBone = this.srcPose.bones[ lnk.srcIndex ];
            tarBone = this.tarPose.bones[ lnk.tarIndex ];

            // ---------------------------------------
            // Move animated local space into TPose world space
            // The Src to Tar rotation is based on the TPose, so the animated
            // pose needs to live in that space. The way it works as if in the
            // whole animation, this bone is the only one that was modified.
            diff.fromMul( lnk.qSrcParent, srcBone.local.rot );

            // ---------------------------------------
            // Using the original worldspace rotation of the tpose, check if rotation
            // has shifted to the opposite hemisphere. Recorrect it by negating the
            // Src to Tar Rotation
            diff.mul( 
                ( Quat.dot( diff, lnk.qDotCheck ) < 0 ) // Dot Check using original bone rotation
                ? tmp.fromNegate( lnk.qSrcToTar )       // Negate Transform rotation to correct the hemisphere on transfer
                : lnk.qSrcToTar                         // No correction needed, transform to target tpose
            );

            // ---------------------------------------
            // Move Target Worldspace transform to localspace by using the original tpose parent ws bone
            tarBone.local.rot.fromMul( lnk.qTarParent, diff );
        }

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Apply Bone Translation for hip
        lnk = this.links.get( 'hip' );
        if( lnk ){
            srcBone = this.srcPose.bones[ lnk.srcIndex ];
            tarBone = this.tarPose.bones[ lnk.tarIndex ];

            tarBone.local.pos
               .fromSub( srcBone.world.pos, this.srcHip )   // Change from source TPose
               .scale( this.hipScale )                      // Scale Diff to Target's Scale
               .add( this.tarHip )                          // Add Scaled Diff to Target's starting tpose position
        }
    }
    // #endregion
}