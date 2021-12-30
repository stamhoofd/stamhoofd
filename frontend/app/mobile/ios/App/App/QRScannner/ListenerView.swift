//
//  ListenerView.swift
//  App
//
//  Created by Simon Backx on 02/12/2021.
//

import Foundation
import UIKit

class ListenerView: UIView {
    var onFrameChanged: ((CGRect) -> ())?;
    
    override func layoutSubviews() {
        super.layoutSubviews()
        
        self.onFrameChanged?(self.bounds)
    }
}
